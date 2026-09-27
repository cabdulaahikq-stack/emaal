import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { walletActionRateLimiter } from "../middleware/rateLimit.js";
import { verifyPin } from "../services/authService.js";
import * as inventoryService from "../services/inventoryService.js";
import * as saleService from "../services/saleService.js";
import * as paymentRequestService from "../services/paymentRequestService.js";
import * as walletService from "../services/walletService.js";
import { toMinor } from "../lib/money.js";
import { serializeProduct, serializePaymentRequest, serializeSale } from "../lib/serialize.js";
import { NotFoundError } from "../lib/errors.js";
import { prisma } from "../lib/db.js";

export const marketplaceRouter = Router();
marketplaceRouter.use(requireAuth, requireRole("CUSTOMER"));

marketplaceRouter.get("/products", async (req, res, next) => {
  try {
    const products = await inventoryService.listMarketplaceProducts(
      req.query.q as string | undefined,
      req.query.merchantId as string | undefined,
    );
    res.json({ products: products.map(serializeProduct) });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get("/products/qr/:qrToken", async (req, res, next) => {
  try {
    const product = await inventoryService.findProductByQrToken(req.params.qrToken);
    res.json({ product: serializeProduct(product) });
  } catch (err) {
    next(err);
  }
});

const itemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const checkoutSchema = z.object({
  merchantId: z.string().uuid(),
  items: z.array(itemSchema).min(1),
  pin: z.string().regex(/^\d{4}$/),
  idempotencyKey: z.string().uuid(),
});

// Immediate retail checkout — always wallet-tendered (a customer doesn't hand over cash through the app).
marketplaceRouter.post("/checkout", walletActionRateLimiter, async (req, res, next) => {
  try {
    const input = checkoutSchema.parse(req.body);
    await verifyPin(req.session!.sub, input.pin);
    const wallet = await walletService.getWalletForUser(req.session!.sub);
    const sale = await saleService.createRetailSale({
      merchantId: input.merchantId,
      items: input.items,
      tender: "WALLET",
      customerId: req.session!.sub,
      customerWalletId: wallet.id,
      actorUserId: req.session!.sub,
      idempotencyKey: input.idempotencyKey,
    });
    res.status(201).json({ sale: serializeSale(sale) });
  } catch (err) {
    next(err);
  }
});

const wholesaleOrderSchema = z.object({
  merchantId: z.string().uuid(),
  items: z.array(itemSchema).min(1),
  pin: z.string().regex(/^\d{4}$/),
  idempotencyKey: z.string().uuid(),
});

// A wholesale order holds funds and stock but charges nothing until the merchant accepts.
marketplaceRouter.post("/orders", walletActionRateLimiter, async (req, res, next) => {
  try {
    const input = wholesaleOrderSchema.parse(req.body);
    await verifyPin(req.session!.sub, input.pin);
    const wallet = await walletService.getWalletForUser(req.session!.sub);
    const sale = await saleService.createWholesaleOrder({
      merchantId: input.merchantId,
      customerId: req.session!.sub,
      customerWalletId: wallet.id,
      items: input.items,
      idempotencyKey: input.idempotencyKey,
    });
    res.status(201).json({ sale: serializeSale(sale) });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get("/orders", async (req, res, next) => {
  try {
    const sales = await saleService.listCustomerPurchases(req.session!.sub);
    res.json({ sales: sales.map(serializeSale) });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get("/orders/:saleId", async (req, res, next) => {
  try {
    const sale = await saleService.getSale(req.params.saleId);
    if (sale.customerId !== req.session!.sub) throw new NotFoundError("Order not found");
    res.json({ sale: serializeSale(sale) });
  } catch (err) {
    next(err);
  }
});

// --- Payment requests (pull payments via QR/phone) --------------------------

const createRequestSchema = z.object({
  payerPhone: z.string().regex(/^\+?\d{9,15}$/),
  amountUsd: z.number().positive().max(1_000_000),
});

marketplaceRouter.post("/payment-requests", async (req, res, next) => {
  try {
    const input = createRequestSchema.parse(req.body);
    const request = await paymentRequestService.createPaymentRequest({
      requesterId: req.session!.sub,
      payerPhone: input.payerPhone,
      amountMinor: toMinor(input.amountUsd),
    });
    res.status(201).json({ request: serializePaymentRequest(request) });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get("/payment-requests/outstanding", async (req, res, next) => {
  try {
    const requests = await paymentRequestService.listOutstandingRequests(req.session!.sub);
    res.json({ requests: requests.map(serializePaymentRequest) });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get("/payment-requests/incoming", async (req, res, next) => {
  try {
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.session!.sub } });
    const requests = await paymentRequestService.listIncomingRequests(me.phone);
    res.json({ requests: requests.map(serializePaymentRequest) });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.get("/payment-requests/:requestId", async (req, res, next) => {
  try {
    const request = await paymentRequestService.getPaymentRequest(req.params.requestId);
    res.json({ request: serializePaymentRequest(request) });
  } catch (err) {
    next(err);
  }
});

const payRequestSchema = z.object({ pin: z.string().regex(/^\d{4}$/) });

marketplaceRouter.post("/payment-requests/:requestId/pay", walletActionRateLimiter, async (req, res, next) => {
  try {
    const { pin } = payRequestSchema.parse(req.body);
    await verifyPin(req.session!.sub, pin);
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.session!.sub } });
    const request = await paymentRequestService.payPaymentRequest(req.params.requestId!, req.session!.sub, me.phone);
    res.json({ request: serializePaymentRequest(request) });
  } catch (err) {
    next(err);
  }
});

marketplaceRouter.post("/payment-requests/:requestId/cancel", async (req, res, next) => {
  try {
    const request = await paymentRequestService.cancelPaymentRequest(req.params.requestId, req.session!.sub);
    res.json({ request: serializePaymentRequest(request) });
  } catch (err) {
    next(err);
  }
});
