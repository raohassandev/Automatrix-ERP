import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vendorSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "vendors.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.vendor.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "vendors.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = vendorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sanitized = {
    name: sanitizeString(parsed.data.name),
    contactName: parsed.data.contactName ? sanitizeString(parsed.data.contactName) : undefined,
    phone: parsed.data.phone ? sanitizeString(parsed.data.phone) : undefined,
    email: parsed.data.email ? sanitizeString(parsed.data.email) : undefined,
    address: parsed.data.address ? sanitizeString(parsed.data.address) : undefined,
    notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined,
    status: parsed.data.status ? sanitizeString(parsed.data.status) : "ACTIVE",
  };

  const created = await prisma.vendor.create({ data: sanitized });

  await logAudit({
    action: "CREATE_VENDOR",
    entity: "Vendor",
    entityId: created.id,
    newValue: JSON.stringify(sanitized),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
