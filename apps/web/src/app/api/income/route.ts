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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const canViewAll = await requirePermission(session.user.id, "income.view_all");
  const canViewOwn = await requirePermission(session.user.id, "income.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const data = await prisma.income.findMany({
    where: canViewAll ? {} : { addedById: session.user.id },
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
      project: parsed.data.project ? sanitizeString(parsed.data.project) : undefined,
      receiptUrl: parsed.data.receiptUrl ? sanitizeString(parsed.data.receiptUrl) : undefined,
      receiptFileId: parsed.data.receiptFileId ? sanitizeString(parsed.data.receiptFileId) : undefined,
      invoiceId: parsed.data.invoiceId ? sanitizeString(parsed.data.invoiceId) : undefined,
      remarks: parsed.data.remarks ? sanitizeString(parsed.data.remarks) : undefined,
    };

    const approvalLevel = getIncomeApprovalLevel(sanitizedData.amount);
    const requiresApproval = approvalLevel === "L2";

    const created = await prisma.income.create({
      data: {
        date: new Date(sanitizedData.date),
        source: sanitizedData.source,
        category: sanitizedData.category,
        amount: new Prisma.Decimal(sanitizedData.amount),
        paymentMode: sanitizedData.paymentMode,
        project: sanitizedData.project,
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

    if (!requiresApproval && sanitizedData.project) {
      await recalculateProjectFinancials(sanitizedData.project);
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
