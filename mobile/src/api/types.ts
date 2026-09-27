export type UserRole = "CUSTOMER" | "ADMIN";

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
