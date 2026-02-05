import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vendorUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "vendors.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = vendorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = sanitizeString(parsed.data.name);
  if (parsed.data.contactName !== undefined) {
    data.contactName = parsed.data.contactName ? sanitizeString(parsed.data.contactName) : null;
  }
  if (parsed.data.phone !== undefined) data.phone = parsed.data.phone ? sanitizeString(parsed.data.phone) : null;
  if (parsed.data.email !== undefined) data.email = parsed.data.email ? sanitizeString(parsed.data.email) : null;
  if (parsed.data.address !== undefined) data.address = parsed.data.address ? sanitizeString(parsed.data.address) : null;
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes ? sanitizeString(parsed.data.notes) : null;
  if (parsed.data.status) data.status = sanitizeString(parsed.data.status);

  const updated = await prisma.vendor.update({ where: { id }, data });

  await logAudit({
    action: "UPDATE_VENDOR",
    entity: "Vendor",
    entityId: id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "vendors.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
  }

  await prisma.vendor.delete({ where: { id } });

  await logAudit({
    action: "DELETE_VENDOR",
    entity: "Vendor",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
