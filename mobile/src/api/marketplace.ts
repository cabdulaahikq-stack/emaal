import { api } from "./client";
import type { PaymentRequest, Product, Sale } from "./types";

export function listMarketplaceProducts(q?: string, merchantId?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (merchantId) params.set("merchantId", merchantId);
  const qs = params.toString();
  return api.get<{ products: Product[] }>(`/marketplace/products${qs ? `?${qs}` : ""}`);
}

export function getProductByQr(qrToken: string) {
  return api.get<{ product: Product }>(`/marketplace/products/qr/${encodeURIComponent(qrToken)}`);
}

interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export function checkout(input: { merchantId: string; items: CartItem[]; pin: string; idempotencyKey: string }) {
  return api.post<{ sale: Sale }>("/marketplace/checkout", input);
}

export function createWholesaleOrder(input: { merchantId: string; items: CartItem[]; pin: string; idempotencyKey: string }) {
  return api.post<{ sale: Sale }>("/marketplace/orders", input);
}

export function listMyOrders() {
  return api.get<{ sales: Sale[] }>("/marketplace/orders");
}

export function getOrder(saleId: string) {
  return api.get<{ sale: Sale }>(`/marketplace/orders/${saleId}`);
}

export function createPaymentRequest(input: { payerPhone: string; amountUsd: number }) {
  return api.post<{ request: PaymentRequest }>("/marketplace/payment-requests", input);
}

export function listOutstandingPaymentRequests() {
  return api.get<{ requests: PaymentRequest[] }>("/marketplace/payment-requests/outstanding");
}

export function listIncomingPaymentRequests() {
  return api.get<{ requests: PaymentRequest[] }>("/marketplace/payment-requests/incoming");
}

export function getPaymentRequest(id: string) {
  return api.get<{ request: PaymentRequest }>(`/marketplace/payment-requests/${id}`);
}

export function payPaymentRequest(id: string, pin: string) {
  return api.post<{ request: PaymentRequest }>(`/marketplace/payment-requests/${id}/pay`, { pin });
}

export function cancelPaymentRequest(id: string) {
  return api.post<{ request: PaymentRequest }>(`/marketplace/payment-requests/${id}/cancel`);
}
