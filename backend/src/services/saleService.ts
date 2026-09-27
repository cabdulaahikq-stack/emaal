import { Prisma, type Sale, type SaleTender } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import { recordAudit } from "../lib/audit.js";
import { postLedgerPair, reserveHold, releaseHoldOnly } from "./walletService.js";

type Tx = Prisma.TransactionClient;

interface SaleItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

interface VariantRow {
  id: string;
  productId: string;
  stockQty: number;
  reservedQty: number;
}

/** Locks the variant rows (in a stable id order, to avoid deadlocking against a concurrent sale of the same items) and returns them keyed by id. */
async function lockVariants(tx: Tx, variantIds: string[]): Promise<Map<string, VariantRow>> {
  const sorted = [...new Set(variantIds)].sort();
  const map = new Map<string, VariantRow>();
  for (const id of sorted) {
    // eslint-disable-next-line no-await-in-loop
    const rows = await tx.$queryRaw<VariantRow[]>`
      SELECT id, "productId", "stockQty", "reservedQty" FROM "ProductVariant" WHERE id = ${id} FOR UPDATE
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError("Product variant not found");
    map.set(id, row);
  }
  return map;
}

async function priceItems(items: SaleItemInput[], priceOf: (productId: string) => Promise<bigint>) {
  let totalMinor = 0n;
  const priced: Array<SaleItemInput & { unitPriceMinor: bigint }> = [];
  for (const item of items) {
    if (item.quantity <= 0) throw new ValidationError("Quantity must be positive");
    // eslint-disable-next-line no-await-in-loop
    const unitPriceMinor = await priceOf(item.productId);
    priced.push({ ...item, unitPriceMinor });
    totalMinor += unitPriceMinor * BigInt(item.quantity);
  }
  return { priced, totalMinor };
}

async function findIdempotentSale(merchantId: string, idempotencyKey: string): Promise<Sale | null> {
  return prisma.sale.findUnique({ where: { merchantId_idempotencyKey: { merchantId, idempotencyKey } } });
}

interface RetailSaleInput {
  merchantId: string;
  items: SaleItemInput[];
  tender: SaleTender;
  customerId?: string;
  customerWalletId?: string;
  // The StaffMember row (FK target of Sale.staffId), distinct from the actor's own User id below.
  staffId?: string;
  // The real User id doing the audit-logged action — the customer themself, or the staff member's own account (never the StaffMember row's id, which isn't a User).
  actorUserId: string;
  idempotencyKey: string;
}

/**
 * An immediate sale: a customer's own retail checkout, or a staff POS sale.
 * WALLET-tendered sales move money in the same transaction that decrements
 * stock, so a sale can never charge a customer without actually reserving
 * the goods (or vice versa).
 */
export async function createRetailSale(input: RetailSaleInput): Promise<Sale> {
  if (input.items.length === 0) throw new ValidationError("A sale needs at least one item");
  if (input.tender === "WALLET" && !input.customerWalletId) throw new ValidationError("A wallet-tendered sale needs a customer wallet");

  const replay = await findIdempotentSale(input.merchantId, input.idempotencyKey);
  if (replay) return replay;

  const merchantProfile = await prisma.merchantProfile.findUniqueOrThrow({ where: { id: input.merchantId } });

  const { priced, totalMinor } = await priceItems(input.items, async (productId) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    const base = product.retailPriceMinor;
    return base - (base * BigInt(product.discountPercent)) / 100n;
  });

  let sale: Sale;
  try {
    sale = await prisma.$transaction(async (tx) => {
      const variants = await lockVariants(tx, priced.map((i) => i.variantId));

      for (const item of priced) {
        const variant = variants.get(item.variantId)!;
        const sellable = variant.stockQty - variant.reservedQty;
        if (sellable < item.quantity) throw new ConflictError(`Only ${sellable} left in stock for this item`);
      }

      let transactionId: string | undefined;
      if (input.tender === "WALLET") {
        const merchantWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: merchantProfile.userId } });
        const transaction = await tx.transaction.create({
          data: {
            type: "TRANSFER",
            status: "COMPLETED",
            amountMinor: totalMinor,
            idempotencyKey: input.idempotencyKey,
            idempotencyScope: `sale:${input.merchantId}`,
            sourceWalletId: input.customerWalletId,
            destWalletId: merchantWallet.id,
          },
        });
        await postLedgerPair(tx, transaction.id, input.customerWalletId!, merchantWallet.id, totalMinor, { allowNegativeDebit: false });
        transactionId = transaction.id;
      }

      for (const item of priced) {
        await tx.productVariant.update({ where: { id: item.variantId }, data: { stockQty: { decrement: item.quantity } } });
      }

      return tx.sale.create({
        data: {
          merchantId: input.merchantId,
          customerId: input.customerId,
          staffId: input.staffId,
          kind: "RETAIL",
          tender: input.tender,
          status: "COMPLETED",
          totalMinor,
          idempotencyKey: input.idempotencyKey,
          transactionId,
          items: {
            create: priced.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPriceMinor: item.unitPriceMinor,
            })),
          },
        },
        include: { items: true },
      });
    });
  } catch (err) {
    // A concurrent request with the same idempotency key lost the create race —
    // return the row the winner created instead of surfacing a false failure.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await findIdempotentSale(input.merchantId, input.idempotencyKey);
      if (winner) return winner;
    }
    throw err;
  }

  await recordAudit({ actorId: input.actorUserId, action: "sale.completed", targetType: "Sale", targetId: sale.id, metadata: { totalMinor: totalMinor.toString(), tender: input.tender } });
  return sale;
}

interface WholesaleOrderInput {
  merchantId: string;
  customerId: string;
  customerWalletId: string;
  items: SaleItemInput[];
  idempotencyKey: string;
}

/**
 * A wholesale order holds the customer's funds and reserves the stock
 * (neither is committed) until the merchant decides. This is the same
 * hold-then-settle pattern the wallet approval queue uses for large
 * transactions — here the "approver" is the merchant, not an admin.
 */
export async function createWholesaleOrder(input: WholesaleOrderInput): Promise<Sale> {
  if (input.items.length === 0) throw new ValidationError("An order needs at least one item");

  const replay = await findIdempotentSale(input.merchantId, input.idempotencyKey);
  if (replay) return replay;

  const { priced, totalMinor } = await priceItems(input.items, async (productId) => {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    return product.wholesalePriceMinor;
  });

  let sale: Sale;
  try {
    sale = await prisma.$transaction(async (tx) => {
      const variants = await lockVariants(tx, priced.map((i) => i.variantId));
      for (const item of priced) {
        const variant = variants.get(item.variantId)!;
        const sellable = variant.stockQty - variant.reservedQty;
        if (sellable < item.quantity) throw new ConflictError(`Only ${sellable} left in stock for this item`);
      }

      await reserveHold(tx, input.customerWalletId, totalMinor);
      for (const item of priced) {
        await tx.productVariant.update({ where: { id: item.variantId }, data: { reservedQty: { increment: item.quantity } } });
      }

      return tx.sale.create({
        data: {
          merchantId: input.merchantId,
          customerId: input.customerId,
          kind: "WHOLESALE",
          tender: "WALLET",
          status: "PENDING",
          totalMinor,
          idempotencyKey: input.idempotencyKey,
          items: {
            create: priced.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPriceMinor: item.unitPriceMinor,
            })),
          },
        },
        include: { items: true },
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await findIdempotentSale(input.merchantId, input.idempotencyKey);
      if (winner) return winner;
    }
    throw err;
  }

  await recordAudit({ actorId: input.customerId, action: "wholesale_order.created", targetType: "Sale", targetId: sale.id, metadata: { totalMinor: totalMinor.toString() } });
  return sale;
}

async function loadPendingWholesaleSale(merchantId: string, saleId: string) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: true } });
  if (!sale || sale.merchantId !== merchantId) throw new NotFoundError("Order not found");
  if (sale.kind !== "WHOLESALE") throw new ConflictError("Not a wholesale order");
  if (sale.status !== "PENDING") throw new ConflictError("Order has already been decided");
  if (!sale.customerId) throw new ConflictError("Order is missing its customer");
  return sale;
}

/** Merchant (or an authorized staff member) accepts: settles the hold into a real transfer and finalizes stock. */
export async function acceptWholesaleOrder(merchantId: string, saleId: string, decidedByStaffId: string | undefined, merchantUserId: string): Promise<Sale> {
  const pending = await loadPendingWholesaleSale(merchantId, saleId);
  const idempotencyScope = "marketplace-wholesale";

  const sale = await prisma.$transaction(async (tx) => {
    const customerWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: pending.customerId! } });
    const merchantWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: merchantUserId } });

    const transaction = await tx.transaction.create({
      data: {
        type: "TRANSFER",
        status: "COMPLETED",
        amountMinor: pending.totalMinor,
        idempotencyKey: pending.id,
        idempotencyScope,
        sourceWalletId: customerWallet.id,
        destWalletId: merchantWallet.id,
      },
    });
    await postLedgerPair(tx, transaction.id, customerWallet.id, merchantWallet.id, pending.totalMinor, {
      allowNegativeDebit: false,
      releaseHoldMinor: pending.totalMinor,
    });

    for (const item of pending.items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQty: { decrement: item.quantity }, reservedQty: { decrement: item.quantity } },
      });
    }

    return tx.sale.update({
      where: { id: saleId },
      data: { status: "COMPLETED", transactionId: transaction.id, staffId: decidedByStaffId, decidedAt: new Date() },
      include: { items: true },
    });
  });

  await recordAudit({ actorId: merchantUserId, action: "wholesale_order.accepted", targetType: "Sale", targetId: saleId });
  return sale;
}

export async function rejectWholesaleOrder(merchantId: string, saleId: string, decidedByStaffId: string | undefined, merchantUserId: string): Promise<Sale> {
  const pending = await loadPendingWholesaleSale(merchantId, saleId);

  const sale = await prisma.$transaction(async (tx) => {
    const customerWallet = await tx.wallet.findUniqueOrThrow({ where: { userId: pending.customerId! } });
    await releaseHoldOnly(tx, customerWallet.id, pending.totalMinor);
    for (const item of pending.items) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { reservedQty: { decrement: item.quantity } } });
    }
    return tx.sale.update({
      where: { id: saleId },
      data: { status: "REJECTED", staffId: decidedByStaffId, decidedAt: new Date() },
      include: { items: true },
    });
  });

  await recordAudit({ actorId: merchantUserId, action: "wholesale_order.rejected", targetType: "Sale", targetId: saleId });
  return sale;
}

async function assertOwnedSale(merchantId: string, saleId: string): Promise<void> {
  const sale = await prisma.sale.findUnique({ where: { id: saleId } });
  if (!sale || sale.merchantId !== merchantId) throw new NotFoundError("Sale not found");
}

export async function markPrinted(merchantId: string, saleId: string): Promise<Sale> {
  await assertOwnedSale(merchantId, saleId);
  return prisma.sale.update({ where: { id: saleId }, data: { printedAt: new Date() } });
}

export async function markWhatsappSent(merchantId: string, saleId: string): Promise<Sale> {
  await assertOwnedSale(merchantId, saleId);
  return prisma.sale.update({ where: { id: saleId }, data: { whatsappSentAt: new Date() } });
}

export async function getSale(saleId: string) {
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, include: { items: { include: { product: true } } } });
  if (!sale) throw new NotFoundError("Sale not found");
  return sale;
}

export async function listCustomerPurchases(customerId: string) {
  return prisma.sale.findMany({
    where: { customerId },
    include: { items: { include: { product: true } }, merchant: { select: { shopName: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listPendingWholesaleOrders(merchantId: string) {
  return prisma.sale.findMany({
    where: { merchantId, kind: "WHOLESALE", status: "PENDING" },
    include: { items: { include: { product: true } }, customer: { select: { fullName: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** The merchant's "Kaasa" (cash register) view: today's totals and receipts to print/send. */
export async function getCashRegisterSummary(merchantId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [sales, unprintedCount, unsentCount] = await Promise.all([
    prisma.sale.findMany({
      where: { merchantId, status: "COMPLETED", createdAt: { gte: startOfDay } },
      include: { items: true, customer: { select: { fullName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.sale.count({ where: { merchantId, status: "COMPLETED", printedAt: null } }),
    prisma.sale.count({ where: { merchantId, status: "COMPLETED", whatsappSentAt: null } }),
  ]);

  const totalMinor = sales.reduce((sum, s) => sum + s.totalMinor, 0n);
  return { salesToday: sales, totalMinorToday: totalMinor, unprintedCount, unsentCount };
}
