import { prisma } from "./db.js";

const SYSTEM_PHONE = "system:float";
let cachedWalletId: string | null = null;

/** Test-only: clears the in-memory cache after a test wipes the database out from under it. */
export function _resetSystemWalletCache(): void {
  cachedWalletId = null;
}

/**
 * Returns the id of the singleton float wallet — the double-entry counterparty
 * for deposits and withdrawals (money that crossed the boundary to/from an
 * external rail). Created lazily so a fresh dev/test database doesn't need a
 * separate seed step to exercise the ledger.
 */
export async function getSystemWalletId(): Promise<string> {
  if (cachedWalletId) return cachedWalletId;

  const existing = await prisma.wallet.findFirst({ where: { user: { role: "SYSTEM" } } });
  if (existing) {
    cachedWalletId = existing.id;
    return existing.id;
  }

  const created = await prisma.user.create({
    data: {
      role: "SYSTEM",
      fullName: "Emaal Float",
      phone: SYSTEM_PHONE,
      passwordHash: "unusable",
      pinHash: "unusable",
      wallet: { create: { balanceMinor: 0n, currency: "USD" } },
    },
    include: { wallet: true },
  });
  cachedWalletId = created.wallet!.id;
  return created.wallet!.id;
}

/**
 * Returns (creating if needed) a partner's settlement wallet — the balance a
 * partner draws payouts from. Admin funds it via the settlement top-up
 * endpoint; it is never credited by ordinary customer activity.
 */
export async function getOrCreatePartnerWalletId(partnerId: string, partnerName: string): Promise<string> {
  const phone = `partner:${partnerId}`;
  const existing = await prisma.user.findUnique({ where: { phone }, include: { wallet: true } });
  if (existing?.wallet) return existing.wallet.id;

  const created = await prisma.user.create({
    data: {
      role: "SYSTEM",
      fullName: `${partnerName} (settlement)`,
      phone,
      passwordHash: "unusable",
      pinHash: "unusable",
      wallet: { create: { balanceMinor: 0n, currency: "USD" } },
    },
    include: { wallet: true },
  });
  return created.wallet!.id;
}
