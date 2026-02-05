import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { departmentUpdateSchema } from "@/lib/validation";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "departments.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Department not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = departmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = {
      ...(parsed.data.name ? { name: sanitizeString(parsed.data.name) } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description ? sanitizeString(parsed.data.description) : null }
        : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
    };

    const updated = await prisma.department.update({
      where: { id },
      data,
    });

    await logAudit({
      action: "UPDATE_DEPARTMENT",
      entity: "Department",
      entityId: updated.id,
      oldValue: JSON.stringify(existing),
      newValue: JSON.stringify(updated),
      userId: session.user.id,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError?.code === "P2002") {
      return NextResponse.json(
        { success: false, error: "Department name already exists" },
        { status: 400 }
      );
    }
    console.error("Error updating department:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "departments.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Department not found" }, { status: 404 });
  }

  const employeeCount = await prisma.employee.count({
    where: { department: existing.name },
  });
  if (employeeCount > 0) {
    return NextResponse.json(
      { success: false, error: "Department is assigned to employees. Update employees first." },
      { status: 400 }
    );
  }

  await prisma.department.delete({ where: { id } });

  await logAudit({
    action: "DELETE_DEPARTMENT",
    entity: "Department",
    entityId: existing.id,
    oldValue: JSON.stringify(existing),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
