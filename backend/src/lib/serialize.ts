import type { LedgerEntry, PaymentRequest, Product, ProductVariant, Sale, SaleItem, Transaction, Wallet } from "@prisma/client";
import { fromMinor } from "./money.js";

export function serializeWallet(wallet: Wallet) {
  return {
    id: wallet.id,
    userId: wallet.userId,
    status: wallet.status,
    currency: wallet.currency,
    balance: fromMinor(wallet.balanceMinor),
    held: fromMinor(wallet.heldMinor),
    available: fromMinor(wallet.balanceMinor - wallet.heldMinor),
    updatedAt: wallet.updatedAt,
  };
}

export function serializeTransaction(tx: Transaction) {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amount: fromMinor(tx.amountMinor),
    currency: tx.currency,
    sourceWalletId: tx.sourceWalletId,
    destWalletId: tx.destWalletId,
    partnerId: tx.partnerId,
    failureReason: tx.failureReason,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

export function serializeProduct(
  product: Product & {
    variants?: (ProductVariant & { warehouse?: { name: string; location: string } })[];
    merchant?: { shopName: string };
  },
) {
  return {
    id: product.id,
    merchantId: product.merchantId,
    shopName: product.merchant?.shopName,
    name: product.name,
    category: product.category,
    barcode: product.barcode,
    qrToken: product.qrToken,
    images: product.images,
    description: product.description,
    costPrice: fromMinor(product.costPriceMinor),
    wholesalePrice: fromMinor(product.wholesalePriceMinor),
    retailPrice: fromMinor(product.retailPriceMinor),
    discountPercent: product.discountPercent,
    retailPriceAfterDiscount: fromMinor(product.retailPriceMinor - (product.retailPriceMinor * BigInt(product.discountPercent)) / 100n),
    variants: product.variants?.map((v) => ({
      id: v.id,
      sizeLabel: v.sizeLabel,
      stockQty: v.stockQty,
      reservedQty: v.reservedQty,
      sellableQty: v.stockQty - v.reservedQty,
      warehouse: v.warehouse ? { name: v.warehouse.name, location: v.warehouse.location } : undefined,
    })),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function serializeSale(sale: Sale & { items?: (SaleItem & { product?: Product })[] }) {
  return {
    id: sale.id,
    merchantId: sale.merchantId,
    customerId: sale.customerId,
    staffId: sale.staffId,
    kind: sale.kind,
    tender: sale.tender,
    status: sale.status,
    total: fromMinor(sale.totalMinor),
    transactionId: sale.transactionId,
    printedAt: sale.printedAt,
    whatsappSentAt: sale.whatsappSentAt,
    createdAt: sale.createdAt,
    decidedAt: sale.decidedAt,
    items: sale.items?.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.product?.name,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: fromMinor(item.unitPriceMinor),
      lineTotal: fromMinor(item.unitPriceMinor * BigInt(item.quantity)),
    })),
  };
}

export function serializeStockIntake(intake: {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  costPriceMinor: bigint;
  recordedById: string | null;
  createdAt: Date;
  recordedBy?: { user: { fullName: string } } | null;
}) {
  return {
    id: intake.id,
    productId: intake.productId,
    variantId: intake.variantId,
    quantity: intake.quantity,
    costPrice: fromMinor(intake.costPriceMinor),
    recordedByName: intake.recordedBy?.user.fullName,
    createdAt: intake.createdAt,
  };
}

export function serializePaymentRequest(request: PaymentRequest & { requester?: { fullName: string; phone: string } }) {
  return {
    id: request.id,
    requesterId: request.requesterId,
    requesterName: request.requester?.fullName,
    requesterPhone: request.requester?.phone,
    payerPhone: request.payerPhone,
    amount: fromMinor(request.amountMinor),
    status: request.status,
    transactionId: request.transactionId,
    createdAt: request.createdAt,
    decidedAt: request.decidedAt,
  };
}

export function serializeLedgerEntry(entry: LedgerEntry) {
  return {
    id: entry.id,
    walletId: entry.walletId,
    transactionId: entry.transactionId,
    direction: entry.direction,
    amount: fromMinor(entry.amountMinor),
    balanceAfter: fromMinor(entry.balanceAfterMinor),
    createdAt: entry.createdAt,
  };
}
