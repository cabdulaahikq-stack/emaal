import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireMerchantOrStaff } from "../middleware/merchantAuth.js";
import * as merchantService from "../services/merchantService.js";
import * as inventoryService from "../services/inventoryService.js";
import * as saleService from "../services/saleService.js";
import { fromMinor, toMinor } from "../lib/money.js";
import { serializeProduct, serializeSale, serializeStockIntake, serializeWallet } from "../lib/serialize.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { prisma } from "../lib/db.js";
import { verifyPin } from "../services/authService.js";

export const merchantRouter = Router();
// Only requireAuth at the router level: some routes below are merchant-only
// (requireRole("MERCHANT")), others are shared with permitted staff
// (requireMerchantOrStaff) — a blanket role check here would reject staff
// before they ever reach the routes meant to allow them.
merchantRouter.use(requireAuth);

merchantRouter.get("/me", requireRole("MERCHANT"), async (req, res, next) => {
  try {
    const profile = await merchantService.getMerchantProfileForUser(req.session!.sub);
    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: req.session!.sub } });
    res.json({ merchant: profile, wallet: serializeWallet(wallet) });
  } catch (err) {
    next(err);
  }
});

// --- Staff -----------------------------------------------------------------

const createStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().regex(/^\+?\d{9,15}$/),
  jobTitle: z.string().min(2).max(60),
  canTakeOrders: z.boolean().optional(),
  canSell: z.boolean().optional(),
  canCollectCash: z.boolean().optional(),
  canPayoutCash: z.boolean().optional(),
  canIntakeStock: z.boolean().optional(),
});

merchantRouter.post("/staff", requireRole("MERCHANT"), async (req, res, next) => {
  try {
    const input = createStaffSchema.parse(req.body);
    const profile = await merchantService.getMerchantProfileForUser(req.session!.sub);
    const { staff, credentials } = await merchantService.createStaff(profile.id, input);
    // credentials.password/pin are shown once here and never recoverable — the merchant hands them to the staff member.
    res.status(201).json({ staff, credentials });
  } catch (err) {
    next(err);
  }
});

merchantRouter.get("/staff", requireRole("MERCHANT"), async (req, res, next) => {
  try {
    const profile = await merchantService.getMerchantProfileForUser(req.session!.sub);
    res.json({ staff: await merchantService.listStaff(profile.id) });
  } catch (err) {
    next(err);
  }
});

const updateStaffSchema = z.object({
  jobTitle: z.string().min(2).max(60).optional(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "SUSPENDED"]).optional(),
  canTakeOrders: z.boolean().optional(),
  canSell: z.boolean().optional(),
  canCollectCash: z.boolean().optional(),
  canPayoutCash: z.boolean().optional(),
  canIntakeStock: z.boolean().optional(),
});

merchantRouter.post("/staff/:staffId", requireRole("MERCHANT"), async (req, res, next) => {
  try {
    const input = updateStaffSchema.parse(req.body);
    const profile = await merchantService.getMerchantProfileForUser(req.session!.sub);
    res.json({ staff: await merchantService.updateStaff(profile.id, req.params.staffId!, input) });
  } catch (err) {
    next(err);
  }
});

// --- Warehouses --------------------------------------------------------------

const createWarehouseSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().min(1).max(200),
  responsibleId: z.string().uuid().optional(),
});

merchantRouter.post("/warehouses", requireRole("MERCHANT"), async (req, res, next) => {
  try {
    const input = createWarehouseSchema.parse(req.body);
    const profile = await merchantService.getMerchantProfileForUser(req.session!.sub);
    res.status(201).json({ warehouse: await merchantService.createWarehouse(profile.id, input.name, input.location, input.responsibleId) });
  } catch (err) {
    next(err);
  }
});

merchantRouter.get("/warehouses", requireRole("MERCHANT"), async (req, res, next) => {
  try {
    const profile = await merchantService.getMerchantProfileForUser(req.session!.sub);
    res.json({ warehouses: await merchantService.listWarehouses(profile.id) });
  } catch (err) {
    next(err);
  }
});

// --- Products & inventory ---------------------------------------------------

const variantSchema = z.object({
  sizeLabel: z.string().max(20).optional(),
  initialStockQty: z.number().int().min(0),
  warehouseId: z.string().uuid(),
});

const createProductSchema = z.object({
  name: z.string().min(2).max(160),
  category: z.enum(["SHOES", "CLOTHING", "OTHER"]),
  barcode: z.string().max(64).optional(),
  images: z.array(z.string()).max(4).optional(),
  description: z.string().max(2000).optional(),
  costPriceUsd: z.number().nonnegative(),
  wholesalePriceUsd: z.number().nonnegative(),
  retailPriceUsd: z.number().nonnegative(),
  discountPercent: z.number().int().min(0).max(100).optional(),
  variants: z.array(variantSchema).min(1),
});

merchantRouter.post("/products", requireRole("MERCHANT"), async (req, res, next) => {
  try {
    const input = createProductSchema.parse(req.body);
    const profile = await merchantService.getMerchantProfileForUser(req.session!.sub);
    const product = await inventoryService.createProduct(profile.id, {
      ...input,
      costPriceMinor: toMinor(input.costPriceUsd),
      wholesalePriceMinor: toMinor(input.wholesalePriceUsd),
      retailPriceMinor: toMinor(input.retailPriceUsd),
      actorUserId: req.session!.sub,
    });
    res.status(201).json({ product: serializeProduct(product) });
  } catch (err) {
    next(err);
  }
});

// Browsing the catalog isn't sensitive — any active staff member needs it to sell, not just the merchant.
merchantRouter.get("/products", requireMerchantOrStaff(), async (req, res, next) => {
  try {
    const products = await inventoryService.searchProducts(req.merchantContext!.merchantId, req.query.q as string | undefined);
    res.json({ products: products.map(serializeProduct) });
  } catch (err) {
    next(err);
  }
});

merchantRouter.get("/products/barcode/:barcode", requireMerchantOrStaff(), async (req, res, next) => {
  try {
    const product = await inventoryService.findProductByBarcode(req.merchantContext!.merchantId, req.params.barcode!);
    res.json({ product: serializeProduct(product) });
  } catch (err) {
    next(err);
  }
});

merchantRouter.get("/products/:productId", requireMerchantOrStaff(), async (req, res, next) => {
  try {
    const product = await inventoryService.getProductWithVariants(req.params.productId!);
    if (product.merchantId !== req.merchantContext!.merchantId) throw new NotFoundError("Product not found for this shop");
    const intakes = await inventoryService.listStockIntakes(req.merchantContext!.merchantId, product.id);
    res.json({ product: serializeProduct(product), stockIntakes: intakes.map(serializeStockIntake) });
  } catch (err) {
    next(err);
  }
});

const intakeSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  costPriceUsd: z.number().nonnegative(),
});

// Either the merchant themself, or a staff member explicitly granted canIntakeStock.
merchantRouter.post("/stock-intake", requireMerchantOrStaff("canIntakeStock"), async (req, res, next) => {
  try {
    const input = intakeSchema.parse(req.body);
    const variant = await inventoryService.recordStockIntake(req.merchantContext!.merchantId, {
      variantId: input.variantId,
      quantity: input.quantity,
      costPriceMinor: toMinor(input.costPriceUsd),
      recordedByStaffId: req.merchantContext!.staffId,
    });
    res.status(201).json({ variant });
  } catch (err) {
    next(err);
  }
});

// --- POS sale (staff register) ----------------------------------------------

const posSaleItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

const posSaleSchema = z.object({
  items: z.array(posSaleItemSchema).min(1),
  tender: z.enum(["WALLET", "CASH"]),
  buyerPhone: z.string().regex(/^\+?\d{9,15}$/).optional(),
  buyerPin: z.string().regex(/^\d{4}$/).optional(),
  idempotencyKey: z.string().uuid(),
});

// Rung up by staff at the physical register. A wallet-tendered sale needs the
// buyer's own PIN, entered on this same device — same trust model as an
// in-person card payment, and consistent with how a wallet transfer already
// only needs the sender's own PIN, not a receiver-side confirmation.
merchantRouter.post("/pos/sell", requireMerchantOrStaff("canSell"), async (req, res, next) => {
  try {
    const input = posSaleSchema.parse(req.body);
    let customerId: string | undefined;
    let customerWalletId: string | undefined;

    if (input.tender === "WALLET") {
      if (!input.buyerPhone || !input.buyerPin) throw new ValidationError("A wallet-tendered sale needs the buyer's phone number and PIN");
      const buyer = await prisma.user.findUnique({ where: { phone: input.buyerPhone }, include: { wallet: true } });
      if (!buyer || buyer.role !== "CUSTOMER" || !buyer.wallet) throw new NotFoundError("No customer wallet found for that phone number");
      await verifyPin(buyer.id, input.buyerPin);
      customerId = buyer.id;
      customerWalletId = buyer.wallet.id;
    }

    const sale = await saleService.createRetailSale({
      merchantId: req.merchantContext!.merchantId,
      items: input.items,
      tender: input.tender,
      customerId,
      customerWalletId,
      staffId: req.merchantContext!.staffId,
      actorUserId: req.session!.sub,
      idempotencyKey: input.idempotencyKey,
    });
    res.status(201).json({ sale: serializeSale(sale) });
  } catch (err) {
    next(err);
  }
});

// --- Wholesale orders ---------------------------------------------------------

merchantRouter.get("/orders/pending", requireMerchantOrStaff(), async (req, res, next) => {
  try {
    const orders = await saleService.listPendingWholesaleOrders(req.merchantContext!.merchantId);
    res.json({ orders: orders.map(serializeSale) });
  } catch (err) {
    next(err);
  }
});

merchantRouter.post("/orders/:saleId/accept", requireMerchantOrStaff("canTakeOrders"), async (req, res, next) => {
  try {
    const sale = await saleService.acceptWholesaleOrder(req.merchantContext!.merchantId, req.params.saleId!, req.merchantContext!.staffId, req.merchantContext!.merchantUserId);
    res.json({ sale: serializeSale(sale) });
  } catch (err) {
    next(err);
  }
});

merchantRouter.post("/orders/:saleId/reject", requireMerchantOrStaff("canTakeOrders"), async (req, res, next) => {
  try {
    const sale = await saleService.rejectWholesaleOrder(req.merchantContext!.merchantId, req.params.saleId!, req.merchantContext!.staffId, req.merchantContext!.merchantUserId);
    res.json({ sale: serializeSale(sale) });
  } catch (err) {
    next(err);
  }
});

// --- Kaasa (cash register) ----------------------------------------------------

merchantRouter.get("/cash-register", requireMerchantOrStaff("canCollectCash"), async (req, res, next) => {
  try {
    const summary = await saleService.getCashRegisterSummary(req.merchantContext!.merchantId);
    res.json({
      totalToday: fromMinor(summary.totalMinorToday),
      unprintedCount: summary.unprintedCount,
      unsentCount: summary.unsentCount,
      sales: summary.salesToday.map(serializeSale),
    });
  } catch (err) {
    next(err);
  }
});

merchantRouter.post("/sales/:saleId/printed", requireMerchantOrStaff(), async (req, res, next) => {
  try {
    res.json({ sale: serializeSale(await saleService.markPrinted(req.merchantContext!.merchantId, req.params.saleId!)) });
  } catch (err) {
    next(err);
  }
});

merchantRouter.post("/sales/:saleId/whatsapp-sent", requireMerchantOrStaff(), async (req, res, next) => {
  try {
    res.json({ sale: serializeSale(await saleService.markWhatsappSent(req.merchantContext!.merchantId, req.params.saleId!)) });
  } catch (err) {
    next(err);
  }
});
