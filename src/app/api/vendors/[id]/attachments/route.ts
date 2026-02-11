import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, getUserRoleName } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { z } from "zod";

const attachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  url: z.string().trim().min(1).max(2048),
  mimeType: z.string().trim().max(128).optional(),
  sizeBytes: z.number().int().positive().optional(),
});

async function canAccessVendor(args: { userId: string; vendorId: string }) {
  const role = await getUserRoleName(args.userId);
  const canViewAll =
    hasPermission(role, "procurement.view_all") || hasPermission(role, "vendors.view_all");
  if (canViewAll) return { ok: true as const };

  const canViewAssigned = await requirePermission(args.userId, "projects.view_assigned");
  const canViewProjectsAll = await requirePermission(args.userId, "projects.view_all");
  if (!canViewAssigned && !canViewProjectsAll) return { ok: false as const, status: 403 as const };

  const assigned = await prisma.projectAssignment.findMany({
    where: { userId: args.userId },
    select: { project: { select: { projectId: true } } },
  });
  const refs = Array.from(new Set(assigned.map((a) => a.project.projectId).filter(Boolean)));
  if (refs.length === 0) return { ok: false as const, status: 403 as const };

  const visible = await prisma.purchaseOrder.findFirst({
    where: { vendorId: args.vendorId, projectRef: { in: refs } },
    select: { id: true },
  });
  if (visible) return { ok: true as const };

  const bill = await prisma.vendorBill.findFirst({
    where: { vendorId: args.vendorId, projectRef: { in: refs } },
    select: { id: true },
  });
  if (bill) return { ok: true as const };

  return { ok: false as const, status: 403 as const };
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params; // vendor id
  const vendor = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
  if (!vendor) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const access = await canAccessVendor({ userId: session.user.id, vendorId: id });
  if (!access.ok) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: access.status });
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
      type: "vendor",
      recordId: id,
      fileName: sanitizeString(parsed.data.fileName),
      fileUrl: sanitizeString(parsed.data.url),
      mimeType: parsed.data.mimeType ? sanitizeString(parsed.data.mimeType) : undefined,
      size: typeof parsed.data.sizeBytes === "number" ? parsed.data.sizeBytes : undefined,
    },
  });

  await logAudit({
    action: "VENDOR_ATTACHMENT_ADD",
    entity: "Vendor",
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

