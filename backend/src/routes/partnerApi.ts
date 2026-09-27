import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireApiKey, requireScope, logPartnerRequest } from "../middleware/apiKeyAuth.js";
import { partnerRateLimit } from "../middleware/partnerRateLimit.js";
import { getOrCreatePartnerWalletId } from "../lib/systemWallet.js";
import * as walletService from "../services/walletService.js";
import { toMinor } from "../lib/money.js";
import { serializeTransaction } from "../lib/serialize.js";
import { NotFoundError } from "../lib/errors.js";

export const partnerApiRouter = Router();
partnerApiRouter.use(requireApiKey, partnerRateLimit);
partnerApiRouter.use((req, res, next) => {
  res.on("finish", () => {
    logPartnerRequest(req, res.statusCode).catch(() => undefined);
  });
  next();
});

partnerApiRouter.get("/wallets/:phone", requireScope("balance:read"), async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { phone: req.params.phone } });
    if (!user || user.role !== "CUSTOMER") {
      res.json({ found: false });
      return;
    }
    res.json({ found: true, name: user.fullName });
  } catch (err) {
    next(err);
  }
});

partnerApiRouter.get("/transactions/:id", requireScope("transaction:read"), async (req, res, next) => {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!tx || tx.partnerId !== req.partner!.id) throw new NotFoundError("Transaction not found");
    res.json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});

const payoutSchema = z.object({
  toPhone: z.string().regex(/^\+?\d{9,15}$/),
  amountUsd: z.number().positive().max(1_000_000),
  idempotencyKey: z.string().uuid(),
});

// A payout credits a customer wallet from the partner's own settlement
// balance — e.g. a refund or cashback. It never debits a customer, so it
// needs no customer PIN step-up (only a partner's own signed API key).
partnerApiRouter.post("/payouts", requireScope("transfer:write"), async (req, res, next) => {
  try {
    const input = payoutSchema.parse(req.body);
    const recipient = await prisma.user.findUnique({ where: { phone: input.toPhone } });
    if (!recipient || recipient.role !== "CUSTOMER") throw new NotFoundError("Recipient not found");

    const partnerWalletId = await getOrCreatePartnerWalletId(req.partner!.id, req.partner!.name);
    const destWallet = await walletService.getWalletForUser(recipient.id);

    const tx = await walletService.transfer(partnerWalletId, destWallet.id, {
      amountMinor: toMinor(input.amountUsd),
      idempotencyKey: input.idempotencyKey,
      idempotencyScope: `partner:${req.partner!.id}`,
      partnerId: req.partner!.id,
    });
    res.status(201).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});
