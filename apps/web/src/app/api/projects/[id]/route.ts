import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "projects.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name) data.name = sanitizeString(body.name);
  if (body.client) data.client = sanitizeString(body.client);
  if (body.status) data.status = sanitizeString(body.status);
  if (body.endDate) data.endDate = new Date(body.endDate);
  if (body.contractValue !== undefined) data.contractValue = new Prisma.Decimal(body.contractValue);

  const updated = await prisma.project.update({ where: { id }, data });

  await logAudit({
    action: "UPDATE_PROJECT",
    entity: "Project",
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
  const canEdit = await requirePermission(session.user.id, "projects.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  await prisma.project.delete({ where: { id } });

  await logAudit({
    action: "DELETE_PROJECT",
    entity: "Project",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
