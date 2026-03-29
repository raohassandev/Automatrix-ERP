import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { sanitizeString } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
import {
  isProcurementAttachmentLocked,
  procurementAttachmentLockMessage,
  validateProcurementAttachmentFormat,
} from "@/lib/procurement-attachment-policy";

const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  url: z.string().trim().min(1).max(2048),
  mimeType: z.string().trim().max(128).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "procurement.view_all");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const payment = await prisma.vendorPayment.findUnique({ where: { id }, select: { id: true } });
  if (!payment) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const rows = await prisma.attachment.findMany({
    where: { type: "vendor_payment", recordId: id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ success: true, data: rows });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "procurement.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const payment = await prisma.vendorPayment.findUnique({
    where: { id },
    select: { id: true, paymentNumber: true, status: true },
  });
  if (!payment) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (isProcurementAttachmentLocked("vendor_payment", payment.status)) {
    const error = procurementAttachmentLockMessage("Vendor Payment", payment.status);
    await logAudit({
      action: "BLOCK_VENDOR_PAYMENT_ATTACHMENT_LOCKED",
      entity: "VendorPayment",
      entityId: id,
      reason: error,
      userId: session.user.id,
    });
    return NextResponse.json({ success: false, error }, { status: 400 });
  }

  const body = await req.json();
  const parsed = attachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const formatError = validateProcurementAttachmentFormat(parsed.data.fileName, parsed.data.mimeType);
  if (formatError) {
    return NextResponse.json({ success: false, error: formatError }, { status: 400 });
  }

  const created = await prisma.attachment.create({
    data: {
      type: "vendor_payment",
      recordId: id,
      fileName: sanitizeString(parsed.data.fileName),
      fileUrl: sanitizeString(parsed.data.url),
      mimeType: parsed.data.mimeType ? sanitizeString(parsed.data.mimeType) : undefined,
      size: typeof parsed.data.sizeBytes === "number" ? parsed.data.sizeBytes : undefined,
    },
  });

  await logAudit({
    action: "VENDOR_PAYMENT_ATTACHMENT_ADD",
    entity: "VendorPayment",
    entityId: id,
    newValue: JSON.stringify({
      attachmentId: created.id,
      paymentNumber: payment.paymentNumber,
      fileName: created.fileName,
      fileUrl: created.fileUrl,
      mimeType: created.mimeType || null,
      sizeBytes: created.size || null,
    }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
