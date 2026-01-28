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

  const approvalLevel = getIncomeApprovalLevel(parsed.data.amount);
  const requiresApproval = approvalLevel === "L2";

  const created = await prisma.income.create({
    data: {
      date: new Date(parsed.data.date),
      source: parsed.data.source,
      category: parsed.data.category,
      amount: new Prisma.Decimal(parsed.data.amount),
      paymentMode: parsed.data.paymentMode,
      project: parsed.data.project,
      approvalLevel,
      status: requiresApproval ? "PENDING" : "APPROVED",
      addedById: session.user.id,
      approvedById: requiresApproval ? null : session.user.id,
      receiptUrl: parsed.data.receiptUrl,
      receiptFileId: parsed.data.receiptFileId,
      invoiceId: parsed.data.invoiceId,
    },
  });

  await logAudit({
    action: "ADD_INCOME",
    entity: "Income",
    entityId: created.id,
    newValue: JSON.stringify(parsed.data),
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
    message: `Income logged for ${parsed.data.amount}.`,
  });

  if (!requiresApproval && parsed.data.project) {
    await recalculateProjectFinancials(parsed.data.project);
  }

  return NextResponse.json({ success: true, data: created, requiresApproval });
}
