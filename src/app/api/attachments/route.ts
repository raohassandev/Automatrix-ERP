import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attachmentSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";

async function getUserEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

async function assertAttachmentAccess(userId: string, typeRaw: string, recordId: string) {
  const type = typeRaw.trim().toLowerCase();
  if (!type) {
    return { ok: false, status: 400, error: "Attachment type is required" } as const;
  }
  if (!recordId) {
    return { ok: false, status: 400, error: "Attachment recordId is required" } as const;
  }

  if (type === "expense") {
    const canViewAll = await requirePermission(userId, "expenses.view_all");
    const canViewOwn = await requirePermission(userId, "expenses.view_own");
    if (!canViewAll && !canViewOwn) {
      return { ok: false, status: 403, error: "Forbidden" } as const;
    }
    const expense = await prisma.expense.findUnique({
      where: { id: recordId },
      select: { submittedById: true },
    });
    if (!expense) return { ok: false, status: 404, error: "Expense not found" } as const;
    if (!canViewAll && expense.submittedById !== userId) {
      return { ok: false, status: 403, error: "Forbidden" } as const;
    }
    return { ok: true } as const;
  }

  if (type === "income") {
    const canViewAll = await requirePermission(userId, "income.view_all");
    const canViewOwn = await requirePermission(userId, "income.view_own");
    if (!canViewAll && !canViewOwn) {
      return { ok: false, status: 403, error: "Forbidden" } as const;
    }
    const income = await prisma.income.findUnique({
      where: { id: recordId },
      select: { addedById: true },
    });
    if (!income) return { ok: false, status: 404, error: "Income not found" } as const;
    if (!canViewAll && income.addedById !== userId) {
      return { ok: false, status: 403, error: "Forbidden" } as const;
    }
    return { ok: true } as const;
  }

  if (type === "invoice") {
    const canView = await requirePermission(userId, "invoices.view_all");
    if (!canView) return { ok: false, status: 403, error: "Forbidden" } as const;
    const invoice = await prisma.invoice.findUnique({ where: { id: recordId } });
    if (!invoice) return { ok: false, status: 404, error: "Invoice not found" } as const;
    return { ok: true } as const;
  }

  if (type === "project") {
    const canViewAll = await requirePermission(userId, "projects.view_all");
    const canViewAssigned = await requirePermission(userId, "projects.view_assigned");
    if (!canViewAll && !canViewAssigned) {
      return { ok: false, status: 403, error: "Forbidden" } as const;
    }
    const project = await prisma.project.findUnique({ where: { id: recordId } });
    if (!project) return { ok: false, status: 404, error: "Project not found" } as const;
    if (!canViewAll) {
      const assigned = await prisma.projectAssignment.findFirst({
        where: { projectId: project.id, userId },
        select: { id: true },
      });
      if (!assigned) {
        return { ok: false, status: 403, error: "Forbidden" } as const;
      }
    }
    return { ok: true } as const;
  }

  if (type === "client") {
    const canView = await requirePermission(userId, "clients.view_all");
    if (!canView) return { ok: false, status: 403, error: "Forbidden" } as const;
    const client = await prisma.client.findUnique({ where: { id: recordId } });
    if (!client) return { ok: false, status: 404, error: "Client not found" } as const;
    return { ok: true } as const;
  }

  if (type === "employee") {
    const canViewAll = await requirePermission(userId, "employees.view_all");
    const canViewOwn = await requirePermission(userId, "employees.view_own");
    if (!canViewAll && !canViewOwn) {
      return { ok: false, status: 403, error: "Forbidden" } as const;
    }
    const employee = await prisma.employee.findUnique({ where: { id: recordId } });
    if (!employee) return { ok: false, status: 404, error: "Employee not found" } as const;
    if (!canViewAll) {
      const email = await getUserEmail(userId);
      if (!email || employee.email !== email) {
        return { ok: false, status: 403, error: "Forbidden" } as const;
      }
    }
    return { ok: true } as const;
  }

  return { ok: false, status: 400, error: "Unsupported attachment type" } as const;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "attachments.view_all");
  if (!canViewAll) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.attachment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "attachments.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = attachmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const access = await assertAttachmentAccess(session.user.id, parsed.data.type, parsed.data.recordId);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const created = await prisma.attachment.create({
    data: {
      type: parsed.data.type,
      recordId: parsed.data.recordId,
      fileName: parsed.data.fileName,
      fileUrl: parsed.data.fileUrl,
      fileId: parsed.data.fileId,
      size: parsed.data.size,
      mimeType: parsed.data.mimeType,
    },
  });

  await logAudit({
    action: "ATTACH_FILE",
    entity: "Attachment",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: created });
}
