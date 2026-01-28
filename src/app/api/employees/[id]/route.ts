import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "employees.view_all");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name) data.name = body.name;
  if (body.phone !== undefined) data.phone = body.phone;
  if (body.role) data.role = body.role;
  if (body.status) data.status = body.status;

  const updated = await prisma.employee.update({ where: { id }, data });

  await logAudit({
    action: "UPDATE_EMPLOYEE",
    entity: "Employee",
    entityId: id,
    newValue: JSON.stringify(body),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "employees.view_all");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  await prisma.employee.delete({ where: { id } });

  await logAudit({
    action: "DELETE_EMPLOYEE",
    entity: "Employee",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
