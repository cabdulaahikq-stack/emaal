import { API_URL, api } from "./client";
import type { ApiKeySummary, ApiPartner, ApprovalRequest, DashboardSummary, LedgerEntry, Transaction, Wallet } from "./types";

export function getDashboard() {
  return api.get<DashboardSummary>("/admin/dashboard");
}

export function searchWallets(query: string) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return api.get<{ wallets: Wallet[] }>(`/admin/wallets${qs}`);
}

export function getWalletDetail(id: string) {
  return api.get<{ wallet: Wallet; ledger: LedgerEntry[] }>(`/admin/wallets/${id}`);
}

export function getTransactionDetail(id: string) {
  return api.get<{ transaction: Transaction; ledgerEntries: LedgerEntry[]; approvalRequest: unknown }>(`/admin/transactions/${id}`);
}

export function getApprovals(decision: "PENDING" | "APPROVED" | "REJECTED" = "PENDING") {
  return api.get<{ approvals: ApprovalRequest[] }>(`/admin/approvals?decision=${decision}`);
}

export function approveTransaction(transactionId: string, notes?: string) {
  return api.post<{ transaction: Transaction }>(`/admin/approvals/${transactionId}/approve`, { notes });
}

export function rejectTransaction(transactionId: string, notes?: string) {
  return api.post<{ transaction: Transaction }>(`/admin/approvals/${transactionId}/reject`, { notes });
}

export function getPartners() {
  return api.get<{ partners: ApiPartner[] }>("/admin/partners");
}

export function createPartner(name: string, webhookUrl?: string) {
  return api.post<{ partner: ApiPartner }>("/admin/partners", { name, webhookUrl });
}

export function getPartnerDetail(id: string) {
  return api.get<{
    partner: ApiPartner & { apiKeys: ApiKeySummary[] };
    settlementWallet: Wallet;
    requestLogs: Array<{ id: string; method: string; path: string; statusCode: number; createdAt: string }>;
    webhookDeliveries: Array<{ id: string; status: string; attempts: number; createdAt: string }>;
  }>(`/admin/partners/${id}`);
}

export function setPartnerStatus(id: string, status: "ACTIVE" | "SUSPENDED" | "REVOKED") {
  return api.post<{ partner: ApiPartner }>(`/admin/partners/${id}/status`, { status });
}

export function createApiKey(partnerId: string, scopes: string[]) {
  return api.post<{ apiKey: { id: string; plaintext: string; prefix: string; scopes: string[]; createdAt: string } }>(
    `/admin/partners/${partnerId}/keys`,
    { scopes },
  );
}

export function revokeApiKey(partnerId: string, keyId: string) {
  return api.post<{ apiKey: { id: string; revokedAt: string } }>(`/admin/partners/${partnerId}/keys/${keyId}/revoke`);
}

export function topupSettlement(partnerId: string, amountUsd: number) {
  return api.post<{ transaction: Transaction }>(`/admin/partners/${partnerId}/settlement/topup`, { amountUsd });
}

export async function getApiDocsMarkdown(): Promise<string> {
  const res = await fetch(`${API_URL}/v1/docs`);
  return res.text();
}
