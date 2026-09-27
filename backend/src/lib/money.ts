/** All monetary amounts are stored and moved as integer minor units (cents) to avoid float drift. */

export function toMinor(usd: number): bigint {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new RangeError("Amount must be a non-negative finite number");
  }
  return BigInt(Math.round(usd * 100));
}

export function fromMinor(minor: bigint): number {
  return Number(minor) / 100;
}

export function formatMinor(minor: bigint, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(fromMinor(minor));
}
