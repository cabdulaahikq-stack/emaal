import type { NextFunction, Request, Response } from "express";
import type { ApiPartner } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { verifySecret } from "../lib/security.js";
import { AuthError, ForbiddenError } from "../lib/errors.js";
import type { ApiScope } from "../services/partnerService.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      partner?: ApiPartner;
      apiKeyScopes?: string[];
    }
  }
}

export function requireApiKey(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AuthError("Missing API key");
  const plaintext = header.slice("Bearer ".length);
  const prefix = plaintext.replace("emaal_live_", "").slice(0, 8);

  void (async () => {
    const candidates = await prisma.apiKey.findMany({ where: { keyPrefix: prefix, revokedAt: null }, include: { partner: true } });
    for (const candidate of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await verifySecret(candidate.keyHash, plaintext)) {
        if (candidate.partner.status !== "ACTIVE") throw new ForbiddenError("Partner is not active");
        req.partner = candidate.partner;
        req.apiKeyScopes = candidate.scopes;
        await prisma.apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } });
        next();
        return;
      }
    }
    throw new AuthError("Invalid API key");
  })().catch(next);
}

export function requireScope(scope: ApiScope) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.apiKeyScopes?.includes(scope)) throw new ForbiddenError(`Missing required scope: ${scope}`);
    next();
  };
}

export async function logPartnerRequest(req: Request, statusCode: number): Promise<void> {
  if (!req.partner) return;
  await prisma.apiRequestLog.create({
    data: {
      partnerId: req.partner.id,
      method: req.method,
      path: req.path,
      statusCode,
      ipAddress: req.ip ?? null,
    },
  });
}
