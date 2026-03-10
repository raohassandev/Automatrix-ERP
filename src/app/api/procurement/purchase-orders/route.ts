import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { purchaseOrderSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectId } from "@/lib/projects";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "procurement.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.purchaseOrder.findMany({
    orderBy: { orderDate: "desc" },
    include: { items: true, vendor: true },
  });
  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = purchaseOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const sanitized = {
    ...parsed.data,
    poNumber: sanitizeString(parsed.data.poNumber),
    vendorId: parsed.data.vendorId ? sanitizeString(parsed.data.vendorId) : undefined,
    vendorName: sanitizeString(parsed.data.vendorName),
    vendorContact: parsed.data.vendorContact ? sanitizeString(parsed.data.vendorContact) : undefined,
    projectRef: parsed.data.projectRef ? sanitizeString(parsed.data.projectRef) : undefined,
    // Phase 1 lifecycle: create PO as DRAFT; submit/approve are explicit actions.
    status: "DRAFT",
    currency: parsed.data.currency ? sanitizeString(parsed.data.currency) : "PKR",
    notes: parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined,
    items: parsed.data.items.map((item) => ({
      itemName: sanitizeString(item.itemName),
      unit: item.unit ? sanitizeString(item.unit) : undefined,
      quantity: item.quantity,
      unitCost: item.unitCost,
      // Phase 1 (locked): header-only project. We accept item.project for backward compatibility,
      // but we overwrite it to prevent mixed projects within one PO.
      project: undefined as string | undefined,
    })),
  };

  if (sanitized.projectRef) {
    const resolvedProjectRef = await resolveProjectId(sanitized.projectRef);
    if (!resolvedProjectRef) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 400 });
    }
    sanitized.projectRef = resolvedProjectRef;
  }
  sanitized.items = sanitized.items.map((item) => ({ ...item, project: sanitized.projectRef || undefined }));

  if (sanitized.vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: sanitized.vendorId },
      select: { id: true, name: true, contactName: true },
    });
    if (!vendor) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 400 });
    }
    sanitized.vendorName = vendor.name;
    if (!sanitized.vendorContact && vendor.contactName) {
      sanitized.vendorContact = vendor.contactName;
    }
  }

  const totalAmount = sanitized.items.reduce(
    (sum, item) => sum + item.quantity * item.unitCost,
    0
  );

  const created = await prisma.purchaseOrder.create({
    data: {
      poNumber: sanitized.poNumber,
      vendorId: sanitized.vendorId,
      vendorName: sanitized.vendorName,
      vendorContact: sanitized.vendorContact,
      projectRef: sanitized.projectRef || null,
      orderDate: new Date(sanitized.orderDate),
      expectedDate: sanitized.expectedDate ? new Date(sanitized.expectedDate) : null,
      status: sanitized.status,
      currency: sanitized.currency,
      totalAmount: new Prisma.Decimal(totalAmount),
      notes: sanitized.notes,
      items: {
        create: sanitized.items.map((item) => ({
          itemName: item.itemName,
          unit: item.unit,
          quantity: new Prisma.Decimal(item.quantity),
          unitCost: new Prisma.Decimal(item.unitCost),
          total: new Prisma.Decimal(item.quantity * item.unitCost),
          project: item.project,
        })),
      },
    },
    include: { items: true },
  });

  await logAudit({
    action: "CREATE_PURCHASE_ORDER",
    entity: "PurchaseOrder",
    entityId: created.id,
    newValue: JSON.stringify(sanitized),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
