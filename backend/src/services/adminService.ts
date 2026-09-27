import { prisma } from "../lib/db.js";
import { fromMinor } from "../lib/money.js";

export async function getDashboardSummary() {
  const [floatAgg, volumeAgg, pendingCount, failedCount] = await Promise.all([
    prisma.wallet.aggregate({ _sum: { balanceMinor: true, heldMinor: true }, where: { user: { role: "CUSTOMER" } } }),
    prisma.transaction.aggregate({
      _sum: { amountMinor: true },
      where: { status: "COMPLETED", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.approvalRequest.count({ where: { decision: "PENDING" } }),
    prisma.transaction.count({ where: { status: { in: ["FAILED", "REJECTED"] } } }),
  ]);

  const totalFloat = floatAgg._sum.balanceMinor ?? 0n;
  const held = floatAgg._sum.heldMinor ?? 0n;

  return {
    totalFloat: fromMinor(totalFloat),
    availableFloat: fromMinor(totalFloat - held),
    heldFloat: fromMinor(held),
    volume24h: fromMinor(volumeAgg._sum.amountMinor ?? 0n),
    pendingApprovals: pendingCount,
    failedTransactions: failedCount,
  };
}
