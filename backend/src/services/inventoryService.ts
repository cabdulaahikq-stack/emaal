import type { ProductCategory } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { recordAudit } from "../lib/audit.js";

const MAX_IMAGES = 4;

interface VariantInput {
  sizeLabel?: string;
  initialStockQty: number;
  warehouseId: string;
}

interface CreateProductInput {
  name: string;
  category: ProductCategory;
  barcode?: string;
  images?: string[];
  description?: string;
  costPriceMinor: bigint;
  wholesalePriceMinor: bigint;
  retailPriceMinor: bigint;
  discountPercent?: number;
  variants: VariantInput[];
  recordedByStaffId?: string;
  actorUserId: string;
}

function assertVariantShape(category: ProductCategory, variants: VariantInput[]): void {
  if (variants.length === 0) throw new ValidationError("At least one variant (a size, or a single unsized variant) is required");
  if (category === "OTHER") return;
  for (const v of variants) {
    if (!v.sizeLabel?.trim()) throw new ValidationError("Shoes and clothing variants must have a size label");
  }
}

export async function createProduct(merchantId: string, input: CreateProductInput) {
  if (input.name.trim().length < 2) throw new ValidationError("Product name is too short");
  if ((input.images?.length ?? 0) > MAX_IMAGES) throw new ValidationError(`At most ${MAX_IMAGES} images per product`);
  if ((input.discountPercent ?? 0) < 0 || (input.discountPercent ?? 0) > 100) throw new ValidationError("Discount must be between 0 and 100");
  assertVariantShape(input.category, input.variants);

  const warehouseIds = [...new Set(input.variants.map((v) => v.warehouseId))];
  const warehouses = await prisma.warehouse.findMany({ where: { id: { in: warehouseIds }, merchantId } });
  if (warehouses.length !== warehouseIds.length) throw new ValidationError("One or more warehouses were not found for this shop");

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        merchantId,
        name: input.name.trim(),
        category: input.category,
        barcode: input.barcode?.trim() || null,
        images: input.images ?? [],
        description: input.description?.trim(),
        costPriceMinor: input.costPriceMinor,
        wholesalePriceMinor: input.wholesalePriceMinor,
        retailPriceMinor: input.retailPriceMinor,
        discountPercent: input.discountPercent ?? 0,
      },
    });

    for (const v of input.variants) {
      const variant = await tx.productVariant.create({
        data: {
          productId: created.id,
          sizeLabel: v.sizeLabel?.trim() || null,
          warehouseId: v.warehouseId,
          stockQty: v.initialStockQty,
        },
      });
      if (v.initialStockQty > 0) {
        await tx.stockIntake.create({
          data: {
            productId: created.id,
            variantId: variant.id,
            quantity: v.initialStockQty,
            costPriceMinor: input.costPriceMinor,
            recordedById: input.recordedByStaffId,
          },
        });
      }
    }

    return created;
  });

  await recordAudit({ actorId: input.actorUserId, action: "product.created", targetType: "Product", targetId: product.id, metadata: { merchantId, name: input.name } });
  return getProductWithVariants(product.id);
}

export async function getProductWithVariants(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { variants: { include: { warehouse: true }, orderBy: { sizeLabel: "asc" } } },
  });
  if (!product) throw new NotFoundError("Product not found");
  return product;
}

export async function findProductByBarcode(merchantId: string, barcode: string) {
  const product = await prisma.product.findFirst({
    where: { merchantId, barcode },
    include: { variants: { include: { warehouse: true } } },
  });
  if (!product) throw new NotFoundError("No product with that barcode");
  return product;
}

export async function findProductByQrToken(qrToken: string) {
  const product = await prisma.product.findUnique({
    where: { qrToken },
    include: { variants: { include: { warehouse: true } }, merchant: { select: { shopName: true } } },
  });
  if (!product) throw new NotFoundError("Product not found for that QR code");
  return product;
}

/** Customer-facing marketplace browse: across every shop, optionally filtered to one. */
export async function listMarketplaceProducts(query?: string, merchantId?: string) {
  return prisma.product.findMany({
    where: {
      ...(merchantId ? { merchantId } : {}),
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    include: { variants: { include: { warehouse: true } }, merchant: { select: { shopName: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function searchProducts(merchantId: string, query?: string) {
  return prisma.product.findMany({
    where: {
      merchantId,
      ...(query ? { name: { contains: query, mode: "insensitive" } } : {}),
    },
    include: { variants: { include: { warehouse: true } } },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

interface RecordIntakeInput {
  variantId: string;
  quantity: number;
  costPriceMinor: bigint;
  recordedByStaffId?: string;
}

/** Stock-in: increases the shelf count and logs the intake at the cost paid. Merchant/admin-only permission is enforced by the caller. */
export async function recordStockIntake(merchantId: string, input: RecordIntakeInput) {
  if (input.quantity <= 0) throw new ValidationError("Quantity must be positive");

  const variant = await prisma.productVariant.findUnique({ where: { id: input.variantId }, include: { product: true } });
  if (!variant || variant.product.merchantId !== merchantId) throw new NotFoundError("Variant not found for this shop");

  const [updated] = await prisma.$transaction([
    prisma.productVariant.update({ where: { id: input.variantId }, data: { stockQty: { increment: input.quantity } } }),
    prisma.stockIntake.create({
      data: {
        productId: variant.productId,
        variantId: input.variantId,
        quantity: input.quantity,
        costPriceMinor: input.costPriceMinor,
        recordedById: input.recordedByStaffId,
      },
    }),
  ]);

  return updated;
}

export async function listStockIntakes(merchantId: string, productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || product.merchantId !== merchantId) throw new NotFoundError("Product not found for this shop");
  return prisma.stockIntake.findMany({
    where: { productId },
    include: { variant: true, recordedBy: { include: { user: { select: { fullName: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Sellable units right now: physical stock minus whatever's reserved by pending wholesale orders. */
export function sellableQty(variant: { stockQty: number; reservedQty: number }): number {
  return variant.stockQty - variant.reservedQty;
}
