export type UserRole = "CUSTOMER" | "ADMIN" | "MERCHANT" | "STAFF";

export interface User {
  id: string;
  fullName: string;
  phone: string;
  role: UserRole;
}

export interface Wallet {
  id: string;
  userId: string;
  status: "ACTIVE" | "FROZEN" | "CLOSED";
  currency: string;
  balance: number;
  held: number;
  available: number;
  updatedAt: string;
  holderName?: string;
  holderPhone?: string;
  holderStatus?: string;
}

export type TransactionType = "DEPOSIT" | "WITHDRAWAL" | "TRANSFER";
export type TransactionStatus = "PENDING" | "HELD_FOR_APPROVAL" | "COMPLETED" | "REJECTED" | "FAILED" | "REVERSED";

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  sourceWalletId: string | null;
  destWalletId: string | null;
  partnerId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  walletId: string;
  transactionId: string;
  direction: "DEBIT" | "CREDIT";
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

export interface ApprovalRequest {
  id: string;
  reason: string;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  transaction: Transaction;
}

export interface ApiPartner {
  id: string;
  name: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  webhookUrl: string | null;
  rateLimitPerMinute: number;
  createdAt: string;
  _count?: { apiKeys: number; transactions: number };
}

export interface ApiKeySummary {
  id: string;
  keyPrefix: string;
  scopes: string[];
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalFloat: number;
  availableFloat: number;
  heldFloat: number;
  volume24h: number;
  pendingApprovals: number;
  failedTransactions: number;
}

// --- Marketplace ------------------------------------------------------------

export type ProductCategory = "SHOES" | "CLOTHING" | "OTHER";

export interface ProductVariant {
  id: string;
  sizeLabel: string | null;
  stockQty: number;
  reservedQty: number;
  sellableQty: number;
  warehouse?: { name: string; location: string };
}

export interface Product {
  id: string;
  merchantId: string;
  shopName?: string;
  name: string;
  category: ProductCategory;
  barcode: string | null;
  qrToken: string;
  images: string[];
  description: string | null;
  costPrice: number;
  wholesalePrice: number;
  retailPrice: number;
  discountPercent: number;
  retailPriceAfterDiscount: number;
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface StockIntake {
  id: string;
  productId: string;
  variantId: string;
  quantity: number;
  costPrice: number;
  recordedByName?: string;
  createdAt: string;
}

export type SaleKind = "RETAIL" | "WHOLESALE";
export type SaleStatus = "PENDING" | "COMPLETED" | "REJECTED";
export type SaleTender = "WALLET" | "CASH";

export interface SaleItem {
  id: string;
  productId: string;
  productName?: string;
  variantId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  merchantId: string;
  customerId: string | null;
  staffId: string | null;
  kind: SaleKind;
  tender: SaleTender;
  status: SaleStatus;
  total: number;
  transactionId: string | null;
  printedAt: string | null;
  whatsappSentAt: string | null;
  createdAt: string;
  decidedAt: string | null;
  items?: SaleItem[];
}

export type PaymentRequestStatus = "PENDING" | "PAID" | "CANCELLED";

export interface PaymentRequest {
  id: string;
  requesterId: string;
  requesterName?: string;
  requesterPhone?: string;
  payerPhone: string;
  amount: number;
  status: PaymentRequestStatus;
  transactionId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface Warehouse {
  id: string;
  merchantId: string;
  name: string;
  location: string;
  responsibleId: string | null;
  lastCountedAt: string | null;
  createdAt: string;
  responsible?: { user: { fullName: string } } | null;
}

export type StaffStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED";

export interface StaffMember {
  id: string;
  merchantId: string;
  userId: string;
  jobTitle: string;
  status: StaffStatus;
  canTakeOrders: boolean;
  canSell: boolean;
  canCollectCash: boolean;
  canPayoutCash: boolean;
  canIntakeStock: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { fullName: string; phone: string; status: string };
}

export interface MerchantProfile {
  id: string;
  userId: string;
  shopName: string;
  createdAt: string;
}
