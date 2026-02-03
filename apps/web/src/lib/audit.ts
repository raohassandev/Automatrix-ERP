import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  action: string;
  entity: string;
  entityId: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  userId?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      field: params.field,
      oldValue: params.oldValue,
      newValue: params.newValue,
      reason: params.reason,
      userId: params.userId,
    },
  });
}

// Alias for compatibility with approval-engine
export async function createAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  changes?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      action: params.action,
      entity: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      oldValue: params.changes ? JSON.stringify(params.changes) : null,
    },
  });
}
