import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { walletActionRateLimiter } from "../middleware/rateLimit.js";
import { verifyPin } from "../services/authService.js";
import * as walletService from "../services/walletService.js";
import { toMinor } from "../lib/money.js";
import { serializeLedgerEntry, serializeTransaction, serializeWallet } from "../lib/serialize.js";
import { ForbiddenError, NotFoundError } from "../lib/errors.js";

export const walletRouter = Router();
walletRouter.use(requireAuth, requireRole("CUSTOMER"));

walletRouter.get("/me", async (req, res, next) => {
  try {
    const wallet = await walletService.getWalletForUser(req.session!.sub);
    const entries = await prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    });
    res.json({ wallet: serializeWallet(wallet), recentActivity: entries.map(serializeLedgerEntry) });
  } catch (err) {
    next(err);
  }
});

walletRouter.get("/transactions/:id", async (req, res, next) => {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!tx) throw new NotFoundError("Transaction not found");
    const wallet = await walletService.getWalletForUser(req.session!.sub);
    if (tx.sourceWalletId !== wallet.id && tx.destWalletId !== wallet.id) {
      throw new ForbiddenError("Not your transaction");
    }
    res.json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});

walletRouter.get("/lookup/:phone", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { phone: req.params.phone } });
    if (!user || user.role !== "CUSTOMER" || user.id === req.session!.sub) {
      res.json({ found: false });
      return;
    }
    res.json({ found: true, name: user.fullName });
  } catch (err) {
    next(err);
  }
});

const amountSchema = z.number().positive().max(1_000_000);
const idempotencySchema = z.string().uuid();
const pinSchema = z.string().regex(/^\d{4}$/);

const depositSchema = z.object({ amountUsd: amountSchema, pin: pinSchema, idempotencyKey: idempotencySchema });

walletRouter.post("/deposit", walletActionRateLimiter, async (req, res, next) => {
  try {
    const input = depositSchema.parse(req.body);
    await verifyPin(req.session!.sub, input.pin);
    const wallet = await walletService.getWalletForUser(req.session!.sub);
    const tx = await walletService.deposit(wallet.id, {
      amountMinor: toMinor(input.amountUsd),
      idempotencyKey: input.idempotencyKey,
      idempotencyScope: `customer:${req.session!.sub}`,
    });
    res.status(201).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});

const withdrawSchema = depositSchema;

walletRouter.post("/withdraw", walletActionRateLimiter, async (req, res, next) => {
  try {
    const input = withdrawSchema.parse(req.body);
    await verifyPin(req.session!.sub, input.pin);
    const wallet = await walletService.getWalletForUser(req.session!.sub);
    const tx = await walletService.withdraw(wallet.id, {
      amountMinor: toMinor(input.amountUsd),
      idempotencyKey: input.idempotencyKey,
      idempotencyScope: `customer:${req.session!.sub}`,
    });
    res.status(201).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});

const transferSchema = z.object({
  toPhone: z.string().regex(/^\+?\d{9,15}$/),
  amountUsd: amountSchema,
  pin: pinSchema,
  idempotencyKey: idempotencySchema,
});

walletRouter.post("/transfer", walletActionRateLimiter, async (req, res, next) => {
  try {
    const input = transferSchema.parse(req.body);
    await verifyPin(req.session!.sub, input.pin);

    const recipient = await prisma.user.findUnique({ where: { phone: input.toPhone } });
    if (!recipient || recipient.role !== "CUSTOMER") throw new NotFoundError("Recipient not found");
    if (recipient.id === req.session!.sub) throw new ForbiddenError("Cannot transfer to yourself");

    const sourceWallet = await walletService.getWalletForUser(req.session!.sub);
    const destWallet = await walletService.getWalletForUser(recipient.id);

    const tx = await walletService.transfer(sourceWallet.id, destWallet.id, {
      amountMinor: toMinor(input.amountUsd),
      idempotencyKey: input.idempotencyKey,
      idempotencyScope: `customer:${req.session!.sub}`,
    });
    res.status(201).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});
