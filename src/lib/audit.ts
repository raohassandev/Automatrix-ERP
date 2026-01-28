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
