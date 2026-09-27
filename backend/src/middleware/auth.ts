import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import { verifySession, type SessionClaims } from "../lib/security.js";
import { AuthError, ForbiddenError } from "../lib/errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: SessionClaims;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AuthError();
  }
  try {
    req.session = verifySession(header.slice("Bearer ".length));
  } catch {
    throw new AuthError("Invalid or expired session");
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session || !roles.includes(req.session.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}
