import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const typeLower = typeRaw.trim().toLowerCase();
  if (!typeLower) {
    return { ok: false, status: 400, error: "Attachment type is required" } as const;
  }
  if (!recordId) {
    return { ok: false, status: 400, error: "Attachment recordId is required" } as const;
  }

  if (typeLower === "expense") {
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

  if (typeLower === "income") {
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

  if (typeLower === "invoice") {
    const canView = await requirePermission(userId, "invoices.view_all");
    if (!canView) return { ok: false, status: 403, error: "Forbidden" } as const;
    const invoice = await prisma.invoice.findUnique({ where: { id: recordId } });
    if (!invoice) return { ok: false, status: 404, error: "Invoice not found" } as const;
    return { ok: true } as const;
  }

  if (typeLower === "project") {
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

  if (typeLower === "client") {
    const canView = await requirePermission(userId, "clients.view_all");
    if (!canView) return { ok: false, status: 403, error: "Forbidden" } as const;
    const client = await prisma.client.findUnique({ where: { id: recordId } });
    if (!client) return { ok: false, status: 404, error: "Client not found" } as const;
    return { ok: true } as const;
  }

  if (typeLower === "employee") {
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

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canEdit = await requirePermission(session.user.id, "attachments.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const existing = await prisma.attachment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Attachment not found" }, { status: 404 });
  }

  const nextType = body.type || existing.type;
  const access = await assertAttachmentAccess(session.user.id, nextType, existing.recordId);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const data: Record<string, unknown> = {};
  if (body.fileName) data.fileName = body.fileName;
  if (body.fileUrl) data.fileUrl = body.fileUrl;
  if (body.type) data.type = body.type;

  const updated = await prisma.attachment.update({ where: { id }, data });

  await logAudit({
    action: "UPDATE_ATTACHMENT",
    entity: "Attachment",
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

  const canDelete = await requirePermission(session.user.id, "attachments.edit");
  if (!canDelete) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await prisma.attachment.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Attachment not found" }, { status: 404 });
  }
  const access = await assertAttachmentAccess(session.user.id, existing.type, existing.recordId);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }
  await prisma.attachment.delete({ where: { id } });

  await logAudit({
    action: "DELETE_ATTACHMENT",
    entity: "Attachment",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
