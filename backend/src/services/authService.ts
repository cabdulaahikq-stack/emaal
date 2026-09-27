import { prisma } from "../lib/db.js";
import { hashSecret, verifySecret, signSession } from "../lib/security.js";
import { AuthError, ConflictError, ValidationError } from "../lib/errors.js";
import { recordAudit } from "../lib/audit.js";
import type { User } from "@prisma/client";

const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

interface SignupInput {
  fullName: string;
  phone: string;
  password: string;
  pin: string;
}

function assertPinShape(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new ValidationError("PIN must be exactly 4 digits");
  }
}

export async function signup(input: SignupInput): Promise<{ user: User; token: string }> {
  assertPinShape(input.pin);
  if (input.password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }
  const existing = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existing) {
    throw new ConflictError("An account with this phone number already exists");
  }

  const [passwordHash, pinHash] = await Promise.all([hashSecret(input.password), hashSecret(input.pin)]);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        role: "CUSTOMER",
        fullName: input.fullName.trim(),
        phone: input.phone,
        passwordHash,
        pinHash,
        wallet: { create: { balanceMinor: 0n, currency: "USD" } },
      },
    });
    return created;
  });

  await recordAudit({ actorId: user.id, action: "user.signup", targetType: "User", targetId: user.id });

  return { user, token: signSession({ sub: user.id, role: user.role }) };
}

export async function login(phone: string, password: string): Promise<{ user: User; token: string }> {
  const user = await prisma.user.findUnique({ where: { phone } });
  // Always run verifySecret even on a missing user (against a dummy hash) so
  // login timing doesn't reveal which phone numbers have accounts.
  const ok = await verifySecret(user?.passwordHash ?? DUMMY_HASH, password);
  if (!user || !ok) {
    throw new AuthError("Invalid phone number or password");
  }
  if (user.status === "SUSPENDED") {
    throw new AuthError("This account has been suspended");
  }
  await recordAudit({ actorId: user.id, action: "user.login", targetType: "User", targetId: user.id });
  return { user, token: signSession({ sub: user.id, role: user.role }) };
}

/** Verifies the step-up PIN for a money-moving action, with per-user lockout after repeated failures. */
export async function verifyPin(userId: string, pin: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    const secondsLeft = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 1000);
    throw new AuthError(`Too many PIN attempts. Try again in ${secondsLeft}s`);
  }

  const ok = await verifySecret(user.pinHash, pin);
  if (!ok) {
    const failCount = user.pinFailCount + 1;
    const lockedUntil = failCount >= PIN_MAX_ATTEMPTS ? new Date(Date.now() + PIN_LOCKOUT_MS) : null;
    await prisma.user.update({
      where: { id: userId },
      data: { pinFailCount: failCount, pinLockedUntil: lockedUntil },
    });
    if (lockedUntil) {
      await recordAudit({ actorId: userId, action: "pin.locked", targetType: "User", targetId: userId });
      throw new AuthError(`Too many PIN attempts. Locked for ${PIN_LOCKOUT_MS / 60000} minutes`);
    }
    throw new AuthError("Incorrect PIN");
  }

  if (user.pinFailCount > 0 || user.pinLockedUntil) {
    await prisma.user.update({ where: { id: userId }, data: { pinFailCount: 0, pinLockedUntil: null } });
  }
}

// A real argon2id hash of a random value, used to keep login() timing constant
// when the phone number doesn't exist.
const DUMMY_HASH = "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQxMjM0NTY$Q9Z3Y2b0m3v1kzYV3hqzjWJXK3m3o0FQqzC1o3nq0aM";
