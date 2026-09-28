import { api } from "./client";
import type { MerchantProfile, Product, ProductCategory, Sale, StaffMember, StaffStatus, StockIntake, Wallet, Warehouse } from "./types";

export function getMerchantMe() {
  return api.get<{ merchant: MerchantProfile; wallet: Wallet }>("/merchant/me");
}

export interface CreateStaffInput {
  fullName: string;
  phone: string;
  jobTitle: string;
  canTakeOrders?: boolean;
  canSell?: boolean;
  canCollectCash?: boolean;
  canPayoutCash?: boolean;
  canIntakeStock?: boolean;
}

export function createStaff(input: CreateStaffInput) {
  return api.post<{ staff: StaffMember; credentials: { phone: string; password: string; pin: string } }>("/merchant/staff", input);
}

export function listStaff() {
  return api.get<{ staff: StaffMember[] }>("/merchant/staff");
}

export interface UpdateStaffInput {
  jobTitle?: string;
  status?: StaffStatus;
  canTakeOrders?: boolean;
  canSell?: boolean;
  canCollectCash?: boolean;
  canPayoutCash?: boolean;
  canIntakeStock?: boolean;
}

export function updateStaff(staffId: string, input: UpdateStaffInput) {
  return api.post<{ staff: StaffMember }>(`/merchant/staff/${staffId}`, input);
}

export function createWarehouse(input: { name: string; location: string; responsibleId?: string }) {
  return api.post<{ warehouse: Warehouse }>("/merchant/warehouses", input);
}

export function listWarehouses() {
  return api.get<{ warehouses: Warehouse[] }>("/merchant/warehouses");
}

export interface VariantInput {
  sizeLabel?: string;
  initialStockQty: number;
  warehouseId: string;
}

export interface CreateProductInput {
  name: string;
  category: ProductCategory;
  barcode?: string;
  images?: string[];
  description?: string;
  costPriceUsd: number;
  wholesalePriceUsd: number;
  retailPriceUsd: number;
  discountPercent?: number;
  variants: VariantInput[];
}

export function createProduct(input: CreateProductInput) {
  return api.post<{ product: Product }>("/merchant/products", input);
}

export function searchProducts(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api.get<{ products: Product[] }>(`/merchant/products${qs}`);
}

export function getProductByBarcode(barcode: string) {
  return api.get<{ product: Product }>(`/merchant/products/barcode/${encodeURIComponent(barcode)}`);
}

export function getProductDetail(productId: string) {
  return api.get<{ product: Product; stockIntakes: StockIntake[] }>(`/merchant/products/${productId}`);
}

export function recordStockIntake(input: { variantId: string; quantity: number; costPriceUsd: number }) {
  return api.post<{ variant: unknown }>("/merchant/stock-intake", input);
}

interface PosItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export function posSell(input: { items: PosItem[]; tender: "WALLET" | "CASH"; buyerPhone?: string; buyerPin?: string; idempotencyKey: string }) {
  return api.post<{ sale: Sale }>("/merchant/pos/sell", input);
}

export function listPendingOrders() {
  return api.get<{ orders: Sale[] }>("/merchant/orders/pending");
}

export function acceptOrder(saleId: string) {
  return api.post<{ sale: Sale }>(`/merchant/orders/${saleId}/accept`);
}

export function rejectOrder(saleId: string) {
  return api.post<{ sale: Sale }>(`/merchant/orders/${saleId}/reject`);
}

export function getCashRegister() {
  return api.get<{ totalToday: number; unprintedCount: number; unsentCount: number; sales: Sale[] }>("/merchant/cash-register");
}

export function markPrinted(saleId: string) {
  return api.post<{ sale: Sale }>(`/merchant/sales/${saleId}/printed`);
}

export function markWhatsappSent(saleId: string) {
  return api.post<{ sale: Sale }>(`/merchant/sales/${saleId}/whatsapp-sent`);
}
