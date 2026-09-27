import { Prisma, type Transaction } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { config } from "../lib/config.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors.js";
import { recordAudit } from "../lib/audit.js";
import { getSystemWalletId } from "../lib/systemWallet.js";
import { queueWebhook } from "./webhookService.js";

type Tx = Prisma.TransactionClient;

interface WalletRow {
  id: string;
  balanceMinor: bigint;
  heldMinor: bigint;
  status: "ACTIVE" | "FROZEN" | "CLOSED";
}

/** Locks a wallet row (SELECT ... FOR UPDATE) so concurrent debits/holds can't race past a balance check. */
async function lockWallet(tx: Tx, walletId: string): Promise<WalletRow> {
  const rows = await tx.$queryRaw<WalletRow[]>`
    SELECT id, "balanceMinor", "heldMinor", status FROM "Wallet" WHERE id = ${walletId} FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw new NotFoundError("Wallet not found");
  return row;
}

interface PostLedgerOptions {
  /** Only true for a DEPOSIT's debit side (the system float, which represents external cash and may legitimately go negative). */
  allowNegativeDebit: boolean;
  /** When finalizing a transaction that reserved a hold, releases that hold on the debit wallet in the same update. */
  releaseHoldMinor?: bigint;
}

/**
 * Posts the two balancing ledger entries (debit + credit) for a transaction and
 * updates both wallets' cached balances. Locks wallets in a stable id order so
 * two concurrent transfers moving money in opposite directions can't deadlock.
 */
export async function postLedgerPair(
  tx: Tx,
  transactionId: string,
  debitWalletId: string,
  creditWalletId: string,
  amountMinor: bigint,
  opts: PostLedgerOptions,
): Promise<void> {
  const [firstId, secondId] = [debitWalletId, creditWalletId].sort() as [string, string];
  const first = await lockWallet(tx, firstId);
  const second = firstId === secondId ? first : await lockWallet(tx, secondId);
  const debitRow = debitWalletId === first.id ? first : second;
  const creditRow = creditWalletId === first.id ? first : second;

  if (debitRow.status !== "ACTIVE") throw new ConflictError("Source wallet is not active");
  if (creditRow.status === "CLOSED") throw new ConflictError("Destination wallet is closed");

  // If this debit is finalizing a transaction that already reserved a hold
  // (releaseHoldMinor > 0), that reservation is *for this amount* — add it
  // back before checking, so we're only checking against *other* holds, not
  // double-counting the one this very call is about to release.
  const spendable = debitRow.balanceMinor - debitRow.heldMinor + (opts.releaseHoldMinor ?? 0n);
  if (!opts.allowNegativeDebit && spendable < amountMinor) throw new ConflictError("Insufficient balance");

  const debitAfter = debitRow.balanceMinor - amountMinor;
  const creditAfter = creditRow.balanceMinor + amountMinor;
  const debitHeldAfter = debitRow.heldMinor - (opts.releaseHoldMinor ?? 0n);

  await tx.wallet.update({ where: { id: debitWalletId }, data: { balanceMinor: debitAfter, heldMinor: debitHeldAfter } });
  await tx.wallet.update({ where: { id: creditWalletId }, data: { balanceMinor: creditAfter } });

  await tx.ledgerEntry.create({
    data: { walletId: debitWalletId, transactionId, direction: "DEBIT", amountMinor, balanceAfterMinor: debitAfter },
  });
  await tx.ledgerEntry.create({
    data: { walletId: creditWalletId, transactionId, direction: "CREDIT", amountMinor, balanceAfterMinor: creditAfter },
  });
}

/**
 * Reserves funds against a wallet's spendable (balance - held) amount while a
 * debit awaits a decision — a large transaction awaiting admin approval, or a
 * wholesale marketplace order awaiting the merchant's accept/reject.
 */
export async function reserveHold(tx: Tx, walletId: string, amountMinor: bigint): Promise<void> {
  const row = await lockWallet(tx, walletId);
  if (row.status !== "ACTIVE") throw new ConflictError("Wallet is not active");
  const spendable = row.balanceMinor - row.heldMinor;
  if (spendable < amountMinor) throw new ConflictError("Insufficient balance");
  await tx.wallet.update({ where: { id: walletId }, data: { heldMinor: row.heldMinor + amountMinor } });
}

/** Releases a previously reserved hold without moving any balance (used when a pending decision is rejected). */
export async function releaseHoldOnly(tx: Tx, walletId: string, amountMinor: bigint): Promise<void> {
  const row = await lockWallet(tx, walletId);
  await tx.wallet.update({ where: { id: walletId }, data: { heldMinor: row.heldMinor - amountMinor } });
}

interface CreateMoveInput {
  amountMinor: bigint;
  idempotencyKey: string;
  idempotencyScope: string;
  partnerId?: string;
}

async function findIdempotentReplay(scope: string, key: string): Promise<Transaction | null> {
  return prisma.transaction.findUnique({ where: { idempotencyScope_idempotencyKey: { idempotencyScope: scope, idempotencyKey: key } } });
}

function assertPositiveAmount(amountMinor: bigint): void {
  if (amountMinor <= 0n) throw new ValidationError("Amount must be greater than zero");
}

/**
 * Only a DEPOSIT's debit side is allowed to go negative — it's always the
 * float wallet, representing cash that has moved in from outside the system.
 * Every other debit (a customer's own wallet, or a partner's funded
 * settlement balance) must never go below zero.
 */
function allowsNegativeDebit(type: Transaction["type"]): boolean {
  return type === "DEPOSIT";
}

/**
 * WITHDRAWAL/TRANSFER debits draw down a real balance, so if one lands in the
 * approval queue its amount is reserved immediately — otherwise the same
 * funds could be spent again while the decision is pending. A DEPOSIT has
 * nothing to reserve: nothing has been credited to anyone yet.
 */
function requiresHoldReservation(type: Transaction["type"]): boolean {
  return type !== "DEPOSIT";
}

async function createMoveTransaction(
  type: Transaction["type"],
  debitWalletId: string,
  creditWalletId: string,
  input: CreateMoveInput,
  approvalReason: (amountMinor: bigint) => string,
): Promise<Transaction> {
  assertPositiveAmount(input.amountMinor);

  const replay = await findIdempotentReplay(input.idempotencyScope, input.idempotencyKey);
  if (replay) return replay;

  const needsApproval = input.amountMinor >= config.approvalThresholdMinor;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          type,
          status: needsApproval ? "HELD_FOR_APPROVAL" : "COMPLETED",
          amountMinor: input.amountMinor,
          idempotencyKey: input.idempotencyKey,
          idempotencyScope: input.idempotencyScope,
          sourceWalletId: debitWalletId,
          destWalletId: creditWalletId,
          partnerId: input.partnerId,
        },
      });

      if (needsApproval) {
        await tx.approvalRequest.create({
          data: { transactionId: transaction.id, reason: approvalReason(input.amountMinor) },
        });
        if (requiresHoldReservation(type)) {
          await reserveHold(tx, debitWalletId, input.amountMinor);
        }
      } else {
        await postLedgerPair(tx, transaction.id, debitWalletId, creditWalletId, input.amountMinor, {
          allowNegativeDebit: allowsNegativeDebit(type),
        });
      }

      return transaction;
    });

    if (!needsApproval) {
      await queueWebhook(result.id).catch(() => undefined);
    }
    return result;
  } catch (err) {
    // A concurrent request with the same idempotency key lost the create race —
    // return the row the winner created instead of surfacing a false failure.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const winner = await findIdempotentReplay(input.idempotencyScope, input.idempotencyKey);
      if (winner) return winner;
    }
    throw err;
  }
}

export async function deposit(walletId: string, input: CreateMoveInput): Promise<Transaction> {
  const systemWalletId = await getSystemWalletId();
  return createMoveTransaction(
    "DEPOSIT",
    systemWalletId,
    walletId,
    input,
    (amt) => `Deposit of ${amt} minor units exceeds the auto-approval threshold`,
  );
}

export async function withdraw(walletId: string, input: CreateMoveInput): Promise<Transaction> {
  const systemWalletId = await getSystemWalletId();
  return createMoveTransaction(
    "WITHDRAWAL",
    walletId,
    systemWalletId,
    input,
    (amt) => `Withdrawal of ${amt} minor units exceeds the auto-approval threshold`,
  );
}

export async function transfer(sourceWalletId: string, destWalletId: string, input: CreateMoveInput): Promise<Transaction> {
  if (sourceWalletId === destWalletId) throw new ValidationError("Cannot transfer to the same wallet");
  return createMoveTransaction(
    "TRANSFER",
    sourceWalletId,
    destWalletId,
    input,
    (amt) => `Transfer of ${amt} minor units exceeds the auto-approval threshold`,
  );
}

export async function approveTransaction(transactionId: string, adminId: string, notes?: string): Promise<Transaction> {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    if (transaction.status !== "HELD_FOR_APPROVAL") {
      throw new ConflictError("Transaction is not pending approval");
    }
    if (!transaction.sourceWalletId || !transaction.destWalletId) {
      throw new ConflictError("Transaction is missing wallet references");
    }

    await postLedgerPair(tx, transaction.id, transaction.sourceWalletId, transaction.destWalletId, transaction.amountMinor, {
      allowNegativeDebit: allowsNegativeDebit(transaction.type),
      releaseHoldMinor: requiresHoldReservation(transaction.type) ? transaction.amountMinor : 0n,
    });

    const updated = await tx.transaction.update({ where: { id: transaction.id }, data: { status: "COMPLETED" } });
    await tx.approvalRequest.update({
      where: { transactionId: transaction.id },
      data: { decision: "APPROVED", decidedById: adminId, decidedAt: new Date(), notes },
    });
    return updated;
  });

  await recordAudit({ actorId: adminId, action: "approval.approved", targetType: "Transaction", targetId: transactionId, metadata: { notes } });
  await queueWebhook(result.id).catch(() => undefined);
  return result;
}

export async function rejectTransaction(transactionId: string, adminId: string, notes?: string): Promise<Transaction> {
  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    if (transaction.status !== "HELD_FOR_APPROVAL") {
      throw new ConflictError("Transaction is not pending approval");
    }
    if (requiresHoldReservation(transaction.type) && transaction.sourceWalletId) {
      await releaseHoldOnly(tx, transaction.sourceWalletId, transaction.amountMinor);
    }
    const updated = await tx.transaction.update({ where: { id: transaction.id }, data: { status: "REJECTED" } });
    await tx.approvalRequest.update({
      where: { transactionId: transaction.id },
      data: { decision: "REJECTED", decidedById: adminId, decidedAt: new Date(), notes },
    });
    return updated;
  });

  await recordAudit({ actorId: adminId, action: "approval.rejected", targetType: "Transaction", targetId: transactionId, metadata: { notes } });
  return result;
}

export async function getWalletForUser(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw new NotFoundError("Wallet not found");
  return wallet;
}

export async function assertWalletOwnership(walletId: string, userId: string): Promise<void> {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
  if (!wallet || wallet.userId !== userId) throw new ForbiddenError("Not your wallet");
}
