import { prisma } from "./db.js";
import type { Prisma } from "@prisma/client";

interface AuditParams {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/** Every admin action and every money-moving event writes an immutable audit row. */
export async function recordAudit(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata,
      ipAddress: params.ipAddress ?? null,
    },
  });
}
