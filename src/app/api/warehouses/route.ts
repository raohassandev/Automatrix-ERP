import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(30).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.warehouse.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canManage = await requirePermission(session.user.id, "inventory.adjust");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const created = await prisma.$transaction(async (tx) => {
    if (payload.isDefault) {
      await tx.warehouse.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.warehouse.create({
      data: {
        name: payload.name,
        code: payload.code || undefined,
        isDefault: Boolean(payload.isDefault),
        isActive: payload.isActive !== false,
      },
    });
  });

  await logAudit({
    action: "CREATE_WAREHOUSE",
    entity: "Warehouse",
    entityId: created.id,
    newValue: JSON.stringify(created),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
