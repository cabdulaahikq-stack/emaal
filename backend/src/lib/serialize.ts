import type { LedgerEntry, Transaction, Wallet } from "@prisma/client";
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
