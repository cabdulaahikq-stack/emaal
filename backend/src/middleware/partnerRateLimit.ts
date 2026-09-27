import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors.js";

interface Bucket {
  count: number;
  windowStart: number;
}

// In-memory per-partner token bucket. Fine for a single backend instance;
// swap for a Redis-backed limiter before running more than one instance.
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60 * 1000;

export function partnerRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const partner = req.partner;
  if (!partner) return next();

  const now = Date.now();
  const existing = buckets.get(partner.id);
  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    buckets.set(partner.id, { count: 1, windowStart: now });
    return next();
  }

  if (existing.count >= partner.rateLimitPerMinute) {
    throw new HttpError(429, "rate_limited", "Partner rate limit exceeded");
  }
  existing.count += 1;
  next();
}

export function _resetPartnerRateLimitBuckets(): void {
  buckets.clear();
}
