import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/db.js";
import { AuthError, ForbiddenError } from "../lib/errors.js";

export interface MerchantContext {
  merchantId: string;
  merchantUserId: string;
  staffId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      merchantContext?: MerchantContext;
    }
  }
}

type StaffPermission = "canTakeOrders" | "canSell" | "canCollectCash" | "canPayoutCash" | "canIntakeStock";

/**
 * Resolves the shop a request is acting on behalf of: the caller's own shop
 * if they're a MERCHANT, or their employer's shop if they're a STAFF member
 * with the given permission (and not on leave/suspended). Everyone else is
 * rejected before any route handler runs.
 */
export function requireMerchantOrStaff(permission?: StaffPermission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session) throw new AuthError();

    void (async () => {
      if (req.session!.role === "MERCHANT") {
        const profile = await prisma.merchantProfile.findUnique({ where: { userId: req.session!.sub } });
        if (!profile) throw new ForbiddenError("Merchant profile not found");
        req.merchantContext = { merchantId: profile.id, merchantUserId: req.session!.sub };
        next();
        return;
      }

      if (req.session!.role === "STAFF") {
        const staff = await prisma.staffMember.findUnique({ where: { userId: req.session!.sub } });
        if (!staff) throw new ForbiddenError("Staff account not linked to a shop");
        if (staff.status !== "ACTIVE") throw new ForbiddenError("Staff account is on leave or suspended");
        if (permission && !staff[permission]) throw new ForbiddenError(`Missing permission: ${permission}`);
        const merchantProfile = await prisma.merchantProfile.findUniqueOrThrow({ where: { id: staff.merchantId } });
        req.merchantContext = { merchantId: staff.merchantId, merchantUserId: merchantProfile.userId, staffId: staff.id };
        next();
        return;
      }

      throw new ForbiddenError("Merchant or staff account required");
    })().catch(next);
  };
}
