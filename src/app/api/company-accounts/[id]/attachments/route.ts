import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { z } from "zod";

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

  const canManage = await requirePermission(session.user.id, "company_accounts.manage");
  if (!canManage) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params; // account id
  const account = await prisma.companyAccount.findUnique({ where: { id }, select: { id: true } });
  if (!account) {
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

  const created = await prisma.attachment.create({
    data: {
      type: "company_account",
      recordId: id,
      fileName: sanitizeString(parsed.data.fileName),
      fileUrl: sanitizeString(parsed.data.url),
      mimeType: parsed.data.mimeType ? sanitizeString(parsed.data.mimeType) : undefined,
      size: typeof parsed.data.sizeBytes === "number" ? parsed.data.sizeBytes : undefined,
    },
  });

  await logAudit({
    action: "COMPANY_ACCOUNT_ATTACHMENT_ADD",
    entity: "CompanyAccount",
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

