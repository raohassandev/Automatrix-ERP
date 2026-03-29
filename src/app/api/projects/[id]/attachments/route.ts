import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { z } from "zod";
import { isProjectAttachmentLocked, validateAttachmentFormat } from "@/lib/document-attachment-policy";

const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  url: z.string().trim().min(1).max(2048),
  mimeType: z.string().trim().max(128).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

async function requireProjectAccess(userId: string, projectDbId: string) {
  const canViewAll = await requirePermission(userId, "projects.view_all");
  const canViewAssigned = await requirePermission(userId, "projects.view_assigned");
  if (!canViewAll && !canViewAssigned) return { ok: false as const, status: 403 as const };

  const project = await prisma.project.findUnique({ where: { id: projectDbId }, select: { id: true } });
  if (!project) return { ok: false as const, status: 404 as const };

  if (!canViewAll) {
    const assigned = await prisma.projectAssignment.findFirst({
      where: { projectId: projectDbId, userId },
      select: { id: true },
    });
    if (!assigned) return { ok: false as const, status: 403 as const };
  }

  return { ok: true as const };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const access = await requireProjectAccess(session.user.id, id);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.status === 404 ? "Not found" : "Forbidden" }, { status: access.status });
  }
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, projectId: true, status: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  if (isProjectAttachmentLocked(project.status)) {
    const error = `Attachments are locked because project ${project.projectId} is ${String(project.status || "").toUpperCase()}.`;
    await logAudit({
      action: "BLOCK_PROJECT_ATTACHMENT_LOCKED",
      entity: "Project",
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
      { status: 400 }
    );
  }
  const formatError = validateAttachmentFormat(parsed.data.fileName, parsed.data.mimeType);
  if (formatError) {
    return NextResponse.json({ success: false, error: formatError }, { status: 400 });
  }

  const created = await prisma.attachment.create({
    data: {
      type: "project",
      recordId: id,
      fileName: sanitizeString(parsed.data.fileName),
      fileUrl: sanitizeString(parsed.data.url),
      mimeType: parsed.data.mimeType ? sanitizeString(parsed.data.mimeType) : undefined,
      size: typeof parsed.data.sizeBytes === "number" ? parsed.data.sizeBytes : undefined,
    },
  });

  await logAudit({
    action: "PROJECT_ATTACHMENT_ADD",
    entity: "Project",
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
