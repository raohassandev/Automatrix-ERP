import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "clients.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name) data.name = sanitizeString(body.name);
  if (body.description !== undefined) data.description = sanitizeString(body.description);
  if (body.address !== undefined) data.address = sanitizeString(body.address);

  const updated = await prisma.client.update({
    where: { id },
    data,
  });

  if (Array.isArray(body.contacts)) {
    await prisma.clientContact.deleteMany({ where: { clientId: id } });
    if (body.contacts.length > 0) {
      await prisma.clientContact.createMany({
        data: body.contacts.map((contact: { name: string; phone?: string; designation?: string; email?: string }) => ({
          clientId: id,
          name: sanitizeString(contact.name),
          phone: contact.phone ? sanitizeString(contact.phone) : undefined,
          designation: contact.designation ? sanitizeString(contact.designation) : undefined,
          email: contact.email ? sanitizeString(contact.email) : undefined,
        })),
      });
    }
  }

  await logAudit({
    action: "UPDATE_CLIENT",
    entity: "Client",
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

  const canEdit = await requirePermission(session.user.id, "clients.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const projectCount = await prisma.project.count({ where: { clientId: id } });
  if (projectCount > 0) {
    return NextResponse.json(
      { success: false, error: "Client has active projects. Reassign or delete projects first." },
      { status: 400 }
    );
  }

  await prisma.clientContact.deleteMany({ where: { clientId: id } });
  await prisma.client.delete({ where: { id } });

  await logAudit({
    action: "DELETE_CLIENT",
    entity: "Client",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
