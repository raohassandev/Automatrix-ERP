import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "clients.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: { contacts: true },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "clients.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sanitized = {
    ...parsed.data,
    name: sanitizeString(parsed.data.name),
    description: parsed.data.description ? sanitizeString(parsed.data.description) : undefined,
    address: parsed.data.address ? sanitizeString(parsed.data.address) : undefined,
    contacts:
      parsed.data.contacts?.map((contact) => ({
        name: sanitizeString(contact.name),
        phone: contact.phone ? sanitizeString(contact.phone) : undefined,
        designation: contact.designation ? sanitizeString(contact.designation) : undefined,
        email: contact.email ? sanitizeString(contact.email) : undefined,
      })) ?? [],
  };

  const created = await prisma.client.create({
    data: {
      name: sanitized.name,
      description: sanitized.description,
      address: sanitized.address,
      contacts: sanitized.contacts.length ? { create: sanitized.contacts } : undefined,
    },
    include: { contacts: true },
  });

  await logAudit({
    action: "CREATE_CLIENT",
    entity: "Client",
    entityId: created.id,
    newValue: JSON.stringify(sanitized),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
