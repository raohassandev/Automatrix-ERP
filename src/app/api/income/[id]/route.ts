import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { incomeUpdateSchema } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { getIncomeApprovalLevel, isPendingIncomeStatus } from "@/lib/approvals";
import { recalculateProjectFinancials, resolveProjectId } from "@/lib/projects";
import { Prisma } from "@prisma/client";
import { assertDateInOpenFiscalPeriod, postIncomeApprovalJournal } from "@/lib/accounting";
import { assertInvoiceReceiptWithinOutstanding } from "@/lib/invoice-allocation";

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const income = await prisma.income.findUnique({ where: { id } });
  if (!income) {
    return NextResponse.json({ success: false, error: "Income not found" }, { status: 404 });
  }

  const canEdit = await requirePermission(session.user.id, "income.edit");
  const isOwner = income.addedById === session.user.id;
  if (!canEdit && !(isOwner && isPendingIncomeStatus(income.status))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (!isPendingIncomeStatus(income.status)) {
    return NextResponse.json({ success: false, error: "Only pending income can be edited" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = incomeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.date) data.date = new Date(parsed.data.date);
  if (parsed.data.source) data.source = parsed.data.source;
  if (parsed.data.category) data.category = parsed.data.category;
  if (parsed.data.amount) data.amount = new Prisma.Decimal(parsed.data.amount);
  if (parsed.data.paymentMode) data.paymentMode = parsed.data.paymentMode;
  if (parsed.data.companyAccountId !== undefined) {
    const companyAccountId = parsed.data.companyAccountId?.trim();
    if (!companyAccountId) {
      return NextResponse.json(
        { success: false, error: "Company account is required" },
        { status: 400 }
      );
    }
    const account = await prisma.companyAccount.findUnique({
      where: { id: companyAccountId },
      select: { id: true, isActive: true },
    });
    if (!account || !account.isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid or inactive company account" },
        { status: 400 }
      );
    }
    data.companyAccountId = companyAccountId;
  }
  if (parsed.data.project !== undefined) {
    if (parsed.data.project === null || parsed.data.project === "") {
      data.project = null;
    } else {
      const resolvedProjectId = await resolveProjectId(parsed.data.project);
      if (!resolvedProjectId) {
        return NextResponse.json(
          { success: false, error: "Invalid project reference" },
          { status: 400 }
        );
      }
      data.project = resolvedProjectId;
    }
  }
  if (parsed.data.receiptUrl) data.receiptUrl = parsed.data.receiptUrl;
  if (parsed.data.receiptFileId) data.receiptFileId = parsed.data.receiptFileId;
  if (parsed.data.invoiceId) data.invoiceId = parsed.data.invoiceId;
  if (parsed.data.invoiceId === null || parsed.data.invoiceId === "") data.invoiceId = null;

  let autoApprove = false;
  if (parsed.data.amount) {
    const approvalLevel = getIncomeApprovalLevel(parsed.data.amount);
    data.approvalLevel = approvalLevel;
    if (approvalLevel === "L1") {
      data.status = "APPROVED";
      data.approvedById = session.user.id;
      autoApprove = true;
    } else {
      data.status = "PENDING";
    }
  }
  if (autoApprove && !((data.companyAccountId as string | undefined) || income.companyAccountId)) {
    return NextResponse.json(
      { success: false, error: "Company account is required for auto-approved income posting." },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const nextInvoiceId =
      (data.invoiceId as string | null | undefined) !== undefined
        ? ((data.invoiceId as string | null) || null)
        : income.invoiceId || null;
    const nextProjectRef =
      (data.project as string | null | undefined) !== undefined
        ? ((data.project as string | null) || null)
        : income.project || null;
    const nextAmount =
      (data.amount as Prisma.Decimal | undefined) !== undefined
        ? Number(data.amount as Prisma.Decimal)
        : Number(income.amount);
    const nextDate =
      (data.date as Date | undefined) !== undefined ? (data.date as Date) : new Date(income.date);

    await assertDateInOpenFiscalPeriod(tx, nextDate, "Income date");

    if (nextInvoiceId) {
      const { invoice } = await assertInvoiceReceiptWithinOutstanding(tx, {
        invoiceId: nextInvoiceId,
        receiptAmount: nextAmount,
        excludeIncomeId: income.id,
        projectRef: nextProjectRef,
      });
      if (!nextProjectRef && invoice?.projectId) {
        data.project = invoice.projectId;
      }
    }

    const updated = await tx.income.update({
      where: { id },
      data,
    });

    if (autoApprove) {
      if (!updated.companyAccountId) {
        throw new Error("Company account is required for income posting.");
      }
      await tx.approval.create({
        data: {
          type: "INCOME",
          status: "APPROVED",
          amount: updated.amount,
          approvedAmount: updated.amount,
          incomeId: updated.id,
          approvedById: session.user.id,
        },
      });

      await postIncomeApprovalJournal(tx, {
        incomeId: updated.id,
        amount: Number(updated.amount),
        incomeDate: new Date(updated.date),
        companyAccountId: updated.companyAccountId,
        invoiceId: updated.invoiceId || null,
        projectRef: updated.project || null,
        userId: session.user.id,
        memo: `Income ${updated.id} auto-approved on update`,
      });
    }

    return updated;
  });

  await logAudit({
    action: "UPDATE_INCOME",
    entity: "Income",
    entityId: id,
    newValue: JSON.stringify(parsed.data),
    userId: session.user.id,
  });

  if (result.status === "APPROVED" && result.project) {
    await recalculateProjectFinancials(result.project);
  }

  return NextResponse.json({ success: true, data: result });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const income = await prisma.income.findUnique({ where: { id } });
  if (!income) {
    return NextResponse.json({ success: false, error: "Income not found" }, { status: 404 });
  }

  const canEdit = await requirePermission(session.user.id, "income.edit");
  const isOwner = income.addedById === session.user.id;
  if (!canEdit && !(isOwner && isPendingIncomeStatus(income.status))) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  if (!isPendingIncomeStatus(income.status)) {
    return NextResponse.json({ success: false, error: "Only pending income can be deleted" }, { status: 400 });
  }

  await prisma.income.delete({ where: { id } });

  await logAudit({
    action: "DELETE_INCOME",
    entity: "Income",
    entityId: id,
    userId: session.user.id,
  });

  return NextResponse.json({ success: true });
}
