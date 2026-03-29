import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { z } from "zod";
import { validateAttachmentFormat } from "@/lib/document-attachment-policy";

const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  url: z.string().trim().min(1).max(2048),
  mimeType: z.string().trim().max(128).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canView = await requirePermission(session.user.id, "inventory.view");
  if (!canView) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params; // item id
  const item = await prisma.inventoryItem.findUnique({ where: { id }, select: { id: true } });
  if (!item) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = attachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const formatError = validateAttachmentFormat(parsed.data.fileName, parsed.data.mimeType);
  if (formatError) {
    return NextResponse.json({ success: false, error: formatError }, { status: 400 });
  }

  const created = await prisma.attachment.create({
    data: {
      type: "inventory_item",
      recordId: id,
      fileName: sanitizeString(parsed.data.fileName),
      fileUrl: sanitizeString(parsed.data.url),
      mimeType: parsed.data.mimeType ? sanitizeString(parsed.data.mimeType) : undefined,
      size: typeof parsed.data.sizeBytes === "number" ? parsed.data.sizeBytes : undefined,
    },
  });

  await logAudit({
    action: "ITEM_ATTACHMENT_ADD",
    entity: "InventoryItem",
    entityId: id,
    newValue: JSON.stringify({
      attachmentId: created.id,
      fileName: created.fileName,
      url: created.fileUrl,
      mimeType: created.mimeType || null,
      sizeBytes: created.size || null,
    }),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: { id: created.id } });
}
