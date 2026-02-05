import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";
import { employeeUpdateSchema } from "@/lib/validation";

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

  const parsed = employeeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = sanitizeString(parsed.data.name);
  if (parsed.data.phone !== undefined) {
    data.phone = parsed.data.phone ? sanitizeString(parsed.data.phone) : null;
  }
  if (parsed.data.cnic !== undefined) data.cnic = parsed.data.cnic ? sanitizeString(parsed.data.cnic) : null;
  if (parsed.data.address !== undefined) {
    data.address = parsed.data.address ? sanitizeString(parsed.data.address) : null;
  }
  if (parsed.data.education !== undefined) {
    data.education = parsed.data.education ? sanitizeString(parsed.data.education) : null;
  }
  if (parsed.data.experience !== undefined) {
    data.experience = parsed.data.experience ? sanitizeString(parsed.data.experience) : null;
  }
  if (parsed.data.department !== undefined) {
    data.department = parsed.data.department ? sanitizeString(parsed.data.department) : null;
  }
  if (parsed.data.designation !== undefined) {
    data.designation = parsed.data.designation ? sanitizeString(parsed.data.designation) : null;
  }
  if (parsed.data.reportingOfficerId !== undefined) {
    data.reportingOfficerId = parsed.data.reportingOfficerId
      ? sanitizeString(parsed.data.reportingOfficerId)
      : null;
  }
  if (parsed.data.joinDate !== undefined) {
    data.joinDate = parsed.data.joinDate ? new Date(parsed.data.joinDate) : null;
  }
  if (parsed.data.role) data.role = sanitizeString(parsed.data.role);
  if (parsed.data.status) data.status = sanitizeString(parsed.data.status);

  if (data.reportingOfficerId) {
    const officer = await prisma.employee.findUnique({
      where: { id: data.reportingOfficerId as string },
      select: { id: true },
    });
    if (!officer) {
      return NextResponse.json({ success: false, error: "Reporting officer not found" }, { status: 400 });
    }
  }

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
