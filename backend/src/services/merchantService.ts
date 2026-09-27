import crypto from "node:crypto";
import { prisma } from "../lib/db.js";
import { hashSecret } from "../lib/security.js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import { recordAudit } from "../lib/audit.js";

export async function getMerchantProfileForUser(userId: string) {
  const profile = await prisma.merchantProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Merchant profile not found");
  return profile;
}

function randomDigits(length: number): string {
  return Array.from({ length }, () => crypto.randomInt(0, 10)).join("");
}

interface CreateStaffInput {
  fullName: string;
  phone: string;
  jobTitle: string;
  canTakeOrders?: boolean;
  canSell?: boolean;
  canCollectCash?: boolean;
  canPayoutCash?: boolean;
  canIntakeStock?: boolean;
}

/**
 * A merchant authorizes a staff member by creating their login outright — a
 * one-time password + PIN are generated and returned in this one response
 * (never stored or recoverable, same pattern as partner API keys), for the
 * merchant to hand to the staff member.
 */
export async function createStaff(merchantId: string, input: CreateStaffInput) {
  const existingUser = await prisma.user.findUnique({ where: { phone: input.phone } });
  if (existingUser) throw new ConflictError("An account with this phone number already exists");

  const plaintextPassword = randomDigits(6);
  const plaintextPin = randomDigits(4);
  const [passwordHash, pinHash] = await Promise.all([hashSecret(plaintextPassword), hashSecret(plaintextPin)]);

  const staff = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        role: "STAFF",
        fullName: input.fullName.trim(),
        phone: input.phone,
        passwordHash,
        pinHash,
      },
    });
    return tx.staffMember.create({
      data: {
        merchantId,
        userId: user.id,
        jobTitle: input.jobTitle.trim(),
        canTakeOrders: input.canTakeOrders ?? false,
        canSell: input.canSell ?? false,
        canCollectCash: input.canCollectCash ?? false,
        canPayoutCash: input.canPayoutCash ?? false,
        canIntakeStock: input.canIntakeStock ?? false,
      },
      include: { user: true },
    });
  });

  await recordAudit({
    actorId: staff.user.id,
    action: "staff.created",
    targetType: "StaffMember",
    targetId: staff.id,
    metadata: { merchantId, jobTitle: input.jobTitle },
  });

  return { staff, credentials: { phone: input.phone, password: plaintextPassword, pin: plaintextPin } };
}

interface UpdateStaffInput {
  jobTitle?: string;
  status?: "ACTIVE" | "ON_LEAVE" | "SUSPENDED";
  canTakeOrders?: boolean;
  canSell?: boolean;
  canCollectCash?: boolean;
  canPayoutCash?: boolean;
  canIntakeStock?: boolean;
}

export async function updateStaff(merchantId: string, staffId: string, input: UpdateStaffInput) {
  const staff = await prisma.staffMember.findUnique({ where: { id: staffId } });
  if (!staff || staff.merchantId !== merchantId) throw new NotFoundError("Staff member not found");

  const updated = await prisma.staffMember.update({
    where: { id: staffId },
    data: input,
    include: { user: true },
  });

  await recordAudit({ actorId: staff.userId, action: "staff.updated", targetType: "StaffMember", targetId: staffId, metadata: { ...input } });
  return updated;
}

export async function listStaff(merchantId: string) {
  return prisma.staffMember.findMany({
    where: { merchantId },
    include: { user: { select: { fullName: true, phone: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createWarehouse(merchantId: string, name: string, location: string, responsibleId?: string) {
  if (responsibleId) {
    const responsible = await prisma.staffMember.findUnique({ where: { id: responsibleId } });
    if (!responsible || responsible.merchantId !== merchantId) throw new ValidationError("Responsible staff member not found for this shop");
  }
  return prisma.warehouse.create({ data: { merchantId, name: name.trim(), location: location.trim(), responsibleId } });
}

export async function listWarehouses(merchantId: string) {
  return prisma.warehouse.findMany({
    where: { merchantId },
    include: { responsible: { include: { user: { select: { fullName: true } } } } },
    orderBy: { createdAt: "asc" },
  });
}
