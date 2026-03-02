import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  code: z.string().trim().min(1).max(30).nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "inventory.adjust");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Warehouse not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const updated = await prisma.$transaction(async (tx) => {
    if (payload.isDefault) {
      await tx.warehouse.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.warehouse.update({
      where: { id },
      data: {
        name: payload.name,
        code: payload.code === null ? null : payload.code,
        isDefault: payload.isDefault,
        isActive: payload.isActive,
      },
    });
  });

  await logAudit({
    action: "UPDATE_WAREHOUSE",
    entity: "Warehouse",
    entityId: id,
    oldValue: JSON.stringify(existing),
    newValue: JSON.stringify(updated),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}
