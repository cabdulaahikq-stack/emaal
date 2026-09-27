import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import * as partnerService from "../services/partnerService.js";
import * as walletService from "../services/walletService.js";
import { getOrCreatePartnerWalletId } from "../lib/systemWallet.js";
import { toMinor } from "../lib/money.js";
import { serializeTransaction, serializeWallet } from "../lib/serialize.js";
import { NotFoundError } from "../lib/errors.js";

export const adminPartnersRouter = Router();
adminPartnersRouter.use(requireAuth, requireRole("ADMIN"));

adminPartnersRouter.get("/", async (_req, res, next) => {
  try {
    const partners = await prisma.apiPartner.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { apiKeys: true, transactions: true } } },
    });
    res.json({ partners });
  } catch (err) {
    next(err);
  }
});

const createPartnerSchema = z.object({ name: z.string().min(2).max(120), webhookUrl: z.string().url().optional() });

adminPartnersRouter.post("/", async (req, res, next) => {
  try {
    const input = createPartnerSchema.parse(req.body);
    const partner = await partnerService.createPartner(req.session!.sub, input.name, input.webhookUrl);
    res.status(201).json({ partner });
  } catch (err) {
    next(err);
  }
});

adminPartnersRouter.get("/:id", async (req, res, next) => {
  try {
    const partner = await prisma.apiPartner.findUnique({
      where: { id: req.params.id },
      include: {
        apiKeys: { select: { id: true, keyPrefix: true, scopes: true, revokedAt: true, lastUsedAt: true, createdAt: true } },
      },
    });
    if (!partner) throw new NotFoundError("Partner not found");

    const [requestLogs, webhookDeliveries, settlementWalletId] = await Promise.all([
      prisma.apiRequestLog.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" }, take: 25 }),
      prisma.webhookDelivery.findMany({ where: { partnerId: partner.id }, orderBy: { createdAt: "desc" }, take: 25 }),
      getOrCreatePartnerWalletId(partner.id, partner.name),
    ]);
    const settlementWallet = await prisma.wallet.findUniqueOrThrow({ where: { id: settlementWalletId } });

    res.json({
      partner,
      settlementWallet: serializeWallet(settlementWallet),
      requestLogs,
      webhookDeliveries,
    });
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "REVOKED"]) });

adminPartnersRouter.post("/:id/status", async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const partner = await partnerService.setPartnerStatus(req.session!.sub, req.params.id, status);
    res.json({ partner });
  } catch (err) {
    next(err);
  }
});

const createKeySchema = z.object({ scopes: z.array(z.string()).min(1) });

adminPartnersRouter.post("/:id/keys", async (req, res, next) => {
  try {
    const { scopes } = createKeySchema.parse(req.body);
    const key = await partnerService.createApiKey(req.session!.sub, req.params.id, scopes);
    // plaintext is only ever present in this one response — the client must show/copy it now.
    res.status(201).json({ apiKey: key });
  } catch (err) {
    next(err);
  }
});

adminPartnersRouter.post("/:id/keys/:keyId/revoke", async (req, res, next) => {
  try {
    const key = await partnerService.revokeApiKey(req.session!.sub, req.params.keyId);
    res.json({ apiKey: { id: key.id, revokedAt: key.revokedAt } });
  } catch (err) {
    next(err);
  }
});

const topupSchema = z.object({ amountUsd: z.number().positive().max(10_000_000), idempotencyKey: z.string().uuid().optional() });

adminPartnersRouter.post("/:id/settlement/topup", async (req, res, next) => {
  try {
    const input = topupSchema.parse(req.body);
    const partner = await prisma.apiPartner.findUnique({ where: { id: req.params.id } });
    if (!partner) throw new NotFoundError("Partner not found");

    const walletId = await getOrCreatePartnerWalletId(partner.id, partner.name);
    const tx = await walletService.deposit(walletId, {
      amountMinor: toMinor(input.amountUsd),
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
      idempotencyScope: `admin-topup:${partner.id}`,
    });
    res.status(201).json({ transaction: serializeTransaction(tx) });
  } catch (err) {
    next(err);
  }
});
