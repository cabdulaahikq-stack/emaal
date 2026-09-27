import argon2 from "argon2";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { config } from "./config.js";

// argon2id is used for both the account password and the transaction PIN.
// A 4-digit PIN has only 10,000 possible values, so its real protection comes
// from server-side rate limiting/lockout (see security.ts's pin lockout
// helpers used by authService), never from hash cost alone — but we still
// hash it properly so a database leak doesn't hand out PINs in the clear.
const HASH_OPTS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashSecret(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTS);
}

export async function verifySecret(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

export interface SessionClaims {
  sub: string; // user id
  role: UserRole;
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, config.jwtSecret, { expiresIn: "12h" });
}

export function verifySession(token: string): SessionClaims {
  return jwt.verify(token, config.jwtSecret) as SessionClaims;
}

/** Generates a partner-facing API key. Returns the plaintext (shown once) and its prefix for lookup. */
export function generateApiKey(): { plaintext: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const prefix = raw.slice(0, 8);
  return { plaintext: `emaal_live_${raw}`, prefix };
}

export function hmacSign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time comparison for tokens/signatures to avoid timing side-channels. */
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
