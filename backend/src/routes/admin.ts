import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as walletService from "../services/walletService.js";
import * as adminService from "../services/adminService.js";
import { serializeLedgerEntry, serializeTransaction, serializeWallet } from "../lib/serialize.js";
import { NotFoundError } from "../lib/errors.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/dashboard", async (_req, res, next) => {
  try {
    res.json(await adminService.getDashboardSummary());
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/wallets", async (req, res, next) => {
  try {
    const query = (req.query.q as string | undefined)?.trim();
    const wallets = await prisma.wallet.findMany({
      where: query
        ? {
            user: {
              role: "CUSTOMER",
              OR: [{ phone: { contains: query } }, { fullName: { contains: query, mode: "insensitive" } }],
            },
          }
        : { user: { role: "CUSTOMER" } },
      include: { user: { select: { fullName: true, phone: true, status: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    res.json({
      wallets: wallets.map((w) => ({ ...serializeWallet(w), holderName: w.user.fullName, holderPhone: w.user.phone, holderStatus: w.user.status })),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/wallets/:id", async (req, res, next) => {
  try {
    const wallet = await prisma.wallet.findUnique({ where: { id: req.params.id }, include: { user: true } });
    if (!wallet) throw new NotFoundError("Wallet not found");
    const entries = await prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({
      wallet: { ...serializeWallet(wallet), holderName: wallet.user.fullName, holderPhone: wallet.user.phone, holderStatus: wallet.user.status },
      ledger: entries.map(serializeLedgerEntry),
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/transactions/:id", async (req, res, next) => {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { ledgerEntries: true, approvalRequest: true },
    });
    if (!tx) throw new NotFoundError("Transaction not found");
    res.json({
      transaction: serializeTransaction(tx),
      ledgerEntries: tx.ledgerEntries.map(serializeLedgerEntry),
      approvalRequest: tx.approvalRequest,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/approvals", async (req, res, next) => {
  try {
    const decision = (req.query.decision as string | undefined)?.toUpperCase() ?? "PENDING";
    const approvals = await prisma.approvalRequest.findMany({
      where: { decision: decision as "PENDING" | "APPROVED" | "REJECTED" },
      include: { transaction: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    res.json({
      approvals: approvals.map((a) => ({
        id: a.id,
        reason: a.reason,
        decision: a.decision,
        createdAt: a.createdAt,
        transaction: serializeTransaction(a.transaction),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const decisionSchema = z.object({ notes: z.string().max(500).optional() });

adminRouter.post("/approvals/:transactionId/approve", async (req, res, next) => {
  try {
    const { notes } = decisionSchema.parse(req.body ?? {});
    const tx = await walletService.approveTransaction(req.params.transactionId, req.session!.sub, notes);
    res.json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/approvals/:transactionId/reject", async (req, res, next) => {
  try {
    const { notes } = decisionSchema.parse(req.body ?? {});
    const tx = await walletService.rejectTransaction(req.params.transactionId, req.session!.sub, notes);
    res.json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});
