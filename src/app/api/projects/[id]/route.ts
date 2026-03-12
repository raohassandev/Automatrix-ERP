import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { buildProjectAliases, recalculateProjectFinancials } from "@/lib/projects";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "projects.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name) data.name = sanitizeString(body.name);
  if (body.clientId) data.clientId = sanitizeString(body.clientId);
  if (body.status) data.status = sanitizeString(body.status);
  if (body.endDate) data.endDate = new Date(body.endDate);
  if (body.contractValue !== undefined) data.contractValue = new Prisma.Decimal(body.contractValue);

  const updated = await prisma.project.update({ where: { id }, data });
  await recalculateProjectFinancials(updated.id);
  const refreshed = await prisma.project.findUnique({ where: { id: updated.id } });

  await logAudit({
    action: "UPDATE_PROJECT",
    entity: "Project",
    entityId: id,
    newValue: JSON.stringify(body),
    userId: session.user.id,
  });

  return NextResponse.json({ success: true, data: refreshed ?? updated });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEdit = await requirePermission(session.user.id, "projects.edit");
  if (!canEdit) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const requestUrl = new URL(_req.url);
  const onConflict = requestUrl.searchParams.get("onConflict");
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, projectId: true, name: true, status: true, endDate: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  const aliases = buildProjectAliases(project);

  const dependency = await Promise.all([
    prisma.expense.count({ where: { project: { in: aliases } } }),
    prisma.income.count({ where: { project: { in: aliases } } }),
    prisma.invoice.count({ where: { projectId: { in: aliases } } }),
    prisma.purchaseOrder.count({ where: { projectRef: { in: aliases } } }),
    prisma.goodsReceipt.count({
      where: {
        OR: [{ projectRef: { in: aliases } }, { purchaseOrder: { projectRef: { in: aliases } } }],
      },
    }),
    prisma.vendorBill.count({ where: { projectRef: { in: aliases } } }),
    prisma.vendorPayment.count({ where: { projectRef: { in: aliases } } }),
    prisma.inventoryLedger.count({ where: { project: { in: aliases } } }),
    prisma.journalLine.count({ where: { projectId: id } }),
    prisma.quotation.count({ where: { projectRef: { in: aliases } } }),
    prisma.incentiveEntry.count({ where: { projectRef: { in: aliases } } }),
    prisma.commissionEntry.count({ where: { projectRef: { in: aliases } } }),
  ]);

  const linkedRecords = dependency.reduce((sum, n) => sum + n, 0);
  if (linkedRecords > 0) {
    if (onConflict === "close" || onConflict === "archive") {
      if (project.status !== "CLOSED") {
        await prisma.project.update({
          where: { id },
          data: {
            status: "CLOSED",
            endDate: project.endDate ?? new Date(),
          },
        });
      }

      await logAudit({
        action: "CLOSE_PROJECT_ON_DELETE_CONFLICT",
        entity: "Project",
        entityId: id,
        reason: `Closed on delete conflict: project has ${linkedRecords} linked operational/financial records`,
        userId: session.user.id,
      });

      return NextResponse.json({
        success: true,
        data: {
          id,
          status: "CLOSED",
          action: "CLOSED_INSTEAD_OF_DELETE",
          linkedRecords,
        },
      });
    }

    if (onConflict === "hard") {
      await logAudit({
        action: "BLOCK_HARD_DELETE_PROJECT",
        entity: "Project",
        entityId: id,
        reason: `Hard delete disabled for linked projects (linkedRecords=${linkedRecords})`,
        userId: session.user.id,
      });
      return NextResponse.json(
        {
          success: false,
          error:
            "Hard delete is disabled for linked projects. Close/archive the project and use reversal workflows for corrections.",
        },
        { status: 400 },
      );
    }

    await logAudit({
      action: "DELETE_PROJECT_BLOCKED",
      entity: "Project",
      entityId: id,
      reason: `Delete blocked: project has ${linkedRecords} linked operational/financial records`,
      userId: session.user.id,
    });
    return NextResponse.json(
      {
        success: false,
        error:
          "Project cannot be deleted because it has linked records. Close/archive it and use reversal workflows for corrections.",
      },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.projectAssignment.deleteMany({ where: { projectId: id } });
      await tx.projectTask.deleteMany({ where: { projectId: id } });
      await tx.project.delete({ where: { id } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Project has linked records and cannot be deleted. Close/archive it and use reversal workflows for corrections.",
        },
        { status: 409 },
      );
    }
    throw error;
  }

  await logAudit({
    action: "DELETE_PROJECT",
    entity: "Project",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
