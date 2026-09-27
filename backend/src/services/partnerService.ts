import { prisma } from "../lib/db.js";
import { generateApiKey, hashSecret } from "../lib/security.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import { recordAudit } from "../lib/audit.js";
import crypto from "node:crypto";

const VALID_SCOPES = ["balance:read", "transfer:write", "transaction:read"] as const;
export type ApiScope = (typeof VALID_SCOPES)[number];

export function assertValidScopes(scopes: string[]): void {
  const bad = scopes.filter((s) => !VALID_SCOPES.includes(s as ApiScope));
  if (bad.length > 0) throw new ValidationError(`Unknown scope(s): ${bad.join(", ")}`);
}

export async function createPartner(adminId: string, name: string, webhookUrl?: string) {
  const partner = await prisma.apiPartner.create({
    data: {
      name,
      webhookUrl,
      webhookSecret: webhookUrl ? crypto.randomBytes(24).toString("hex") : null,
    },
  });
  await recordAudit({ actorId: adminId, action: "partner.created", targetType: "ApiPartner", targetId: partner.id, metadata: { name } });
  return partner;
}

export async function setPartnerStatus(adminId: string, partnerId: string, status: "ACTIVE" | "SUSPENDED" | "REVOKED") {
  const partner = await prisma.apiPartner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new NotFoundError("Partner not found");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.apiPartner.update({ where: { id: partnerId }, data: { status } });
    if (status === "REVOKED") {
      await tx.apiKey.updateMany({ where: { partnerId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    return result;
  });

  await recordAudit({ actorId: adminId, action: `partner.${status.toLowerCase()}`, targetType: "ApiPartner", targetId: partnerId });
  return updated;
}

/** Creates a new API key for a partner. The plaintext key is returned once and never stored. */
export async function createApiKey(adminId: string, partnerId: string, scopes: string[]) {
  assertValidScopes(scopes);
  const partner = await prisma.apiPartner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new NotFoundError("Partner not found");
  if (partner.status !== "ACTIVE") throw new ConflictError("Cannot issue keys for a non-active partner");

  const { plaintext, prefix } = generateApiKey();
  const keyHash = await hashSecret(plaintext);

  const key = await prisma.apiKey.create({
    data: { partnerId, keyPrefix: prefix, keyHash, scopes },
  });

  await recordAudit({ actorId: adminId, action: "apikey.created", targetType: "ApiKey", targetId: key.id, metadata: { scopes } });

  return { id: key.id, plaintext, prefix, scopes, createdAt: key.createdAt };
}

export async function revokeApiKey(adminId: string, keyId: string) {
  const key = await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  await recordAudit({ actorId: adminId, action: "apikey.revoked", targetType: "ApiKey", targetId: keyId });
  return key;
}
