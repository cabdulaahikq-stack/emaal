import { api } from "./client";
import type { LedgerEntry, Transaction, Wallet } from "./types";

export function getMyWallet() {
  return api.get<{ wallet: Wallet; recentActivity: LedgerEntry[] }>("/wallet/me");
}

export function getTransaction(id: string) {
  return api.get<{ transaction: Transaction }>(`/wallet/transactions/${id}`);
}

export function lookupPhone(phone: string) {
  return api.get<{ found: boolean; name?: string }>(`/wallet/lookup/${encodeURIComponent(phone)}`);
}

interface MoveInput {
  amountUsd: number;
  pin: string;
  idempotencyKey: string;
}

export function deposit(input: MoveInput) {
  return api.post<{ transaction: Transaction }>("/wallet/deposit", input);
}

export function withdraw(input: MoveInput) {
  return api.post<{ transaction: Transaction }>("/wallet/withdraw", input);
}

export function transfer(input: MoveInput & { toPhone: string }) {
  return api.post<{ transaction: Transaction }>("/wallet/transfer", input);
}
