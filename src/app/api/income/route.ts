import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incomeSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { getIncomeApprovalLevel } from "@/lib/approvals";
import { createNotification } from "@/lib/notifications";
import { recalculateProjectFinancials } from "@/lib/projects";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { resolveProjectDbId, resolveProjectId } from "@/lib/projects";
import { postIncomeApprovalJournal } from "@/lib/accounting";
import { assertInvoiceReceiptWithinOutstanding } from "@/lib/invoice-allocation";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "income.view_all");
  const canViewOwn = await requirePermission(session.user.id, "income.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Record<string, unknown> = canViewAll ? {} : { addedById: session.user.id };
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.date = range;
  }

  const data = await prisma.income.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ success: true, data });
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const canSubmit = await requirePermission(session.user.id, "income.add");
    if (!canSubmit) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = incomeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Sanitize string inputs after validation
    const sanitizedData = {
      ...parsed.data,
      source: sanitizeString(parsed.data.source),
      category: sanitizeString(parsed.data.category || parsed.data.source),
      paymentMode: sanitizeString(parsed.data.paymentMode),
      companyAccountId: sanitizeString(parsed.data.companyAccountId),
      project: parsed.data.project ? sanitizeString(parsed.data.project) : undefined,
      receiptUrl: parsed.data.receiptUrl ? sanitizeString(parsed.data.receiptUrl) : undefined,
      receiptFileId: parsed.data.receiptFileId ? sanitizeString(parsed.data.receiptFileId) : undefined,
      invoiceId: parsed.data.invoiceId ? sanitizeString(parsed.data.invoiceId) : undefined,
      remarks: parsed.data.remarks ? sanitizeString(parsed.data.remarks) : undefined,
    };

    const approvalLevel = getIncomeApprovalLevel(sanitizedData.amount);
    const requiresApproval = approvalLevel === "L2";

    const companyAccount = await prisma.companyAccount.findUnique({
      where: { id: sanitizedData.companyAccountId },
      select: { id: true, isActive: true },
    });
    if (!companyAccount || !companyAccount.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive company account" },
        { status: 400 }
      );
    }

    let resolvedProjectRef: string | null = null;
    let resolvedProjectDbId: string | null = null;
    if (sanitizedData.project) {
      resolvedProjectRef = await resolveProjectId(sanitizedData.project);
      resolvedProjectDbId = await resolveProjectDbId(sanitizedData.project);
      if (!resolvedProjectRef || !resolvedProjectDbId) {
        return NextResponse.json(
          { success: false, error: "Invalid project reference" },
          { status: 400 }
        );
      }

      // Phase 1 RBAC scope: non-global users can log income only against assigned projects.
      const canViewAllProjects = await requirePermission(session.user.id, "projects.view_all");
      if (!canViewAllProjects) {
        const canViewAssignedProjects = await requirePermission(session.user.id, "projects.view_assigned");
        if (!canViewAssignedProjects) {
          return NextResponse.json(
            { success: false, error: "Project access denied for this income entry" },
            { status: 403 }
          );
        }
        const assigned = await prisma.projectAssignment.findFirst({
          where: { projectId: resolvedProjectDbId, userId: session.user.id },
          select: { id: true },
        });
        if (!assigned) {
          await logAudit({
            action: "BLOCK_INCOME_PROJECT_SCOPE",
            entity: "Income",
            entityId: "NEW",
            reason: "User attempted to submit income for unassigned project",
            newValue: JSON.stringify({ projectRef: resolvedProjectRef, projectId: resolvedProjectDbId }),
            userId: session.user.id,
          });
          return NextResponse.json(
            { success: false, error: "You are not assigned to the selected project" },
            { status: 403 }
          );
        }
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      let invoiceProjectRef: string | null = null;
      if (sanitizedData.invoiceId) {
        const { invoice } = await assertInvoiceReceiptWithinOutstanding(tx, {
          invoiceId: sanitizedData.invoiceId,
          receiptAmount: sanitizedData.amount,
          projectRef: resolvedProjectRef || null,
        });
        invoiceProjectRef = invoice?.projectId || null;
      }

      const createdIncome = await tx.income.create({
        data: {
          date: new Date(sanitizedData.date),
          source: sanitizedData.source,
          category: sanitizedData.category,
          amount: new Prisma.Decimal(sanitizedData.amount),
          paymentMode: sanitizedData.paymentMode,
          companyAccountId: sanitizedData.companyAccountId,
          project: resolvedProjectRef || invoiceProjectRef || undefined,
          approvalLevel,
          status: requiresApproval ? "PENDING" : "APPROVED",
          addedById: session.user.id,
          approvedById: requiresApproval ? null : session.user.id,
          receiptUrl: sanitizedData.receiptUrl,
          receiptFileId: sanitizedData.receiptFileId,
          invoiceId: sanitizedData.invoiceId,
          remarks: sanitizedData.remarks,
        },
      });

      if (!requiresApproval) {
        if (!createdIncome.companyAccountId) {
          throw new Error("Company account is required for income posting.");
        }
        if (createdIncome.invoiceId) {
          await assertInvoiceReceiptWithinOutstanding(tx, {
            invoiceId: createdIncome.invoiceId,
            receiptAmount: Number(createdIncome.amount),
          });
        }
        await postIncomeApprovalJournal(tx, {
          incomeId: createdIncome.id,
          amount: Number(createdIncome.amount),
          incomeDate: new Date(createdIncome.date),
          companyAccountId: createdIncome.companyAccountId,
          invoiceId: createdIncome.invoiceId || null,
          projectRef: createdIncome.project || null,
          userId: session.user.id,
          memo: `Income ${createdIncome.id} auto-approved`,
        });
      }

      return createdIncome;
    });

    await logAudit({
      action: "ADD_INCOME",
      entity: "Income",
      entityId: created.id,
      newValue: JSON.stringify(sanitizedData),
      userId: session.user.id,
    });

    if (!requiresApproval) {
      await prisma.approval.create({
        data: {
          type: "INCOME",
          status: "APPROVED",
          amount: created.amount,
          approvedAmount: created.amount,
          incomeId: created.id,
          approvedById: session.user.id,
        },
      });
    }

    await createNotification({
      userId: session.user.id,
      type: "INCOME_SUBMITTED",
      message: `Income logged for ${sanitizedData.amount}.`,
    });

    if (!requiresApproval && resolvedProjectRef) {
      await recalculateProjectFinancials(resolvedProjectRef);
    }

    return NextResponse.json({ success: true, data: created, requiresApproval });
  } catch (error) {
    console.error("Income POST error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: "Internal Server Error",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
