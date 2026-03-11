import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/rbac";
import { Prisma } from "@prisma/client";
import { sanitizeString } from "@/lib/sanitize";
import { buildProjectAliases, recalculateProjectFinancials } from "@/lib/projects";

type ProjectDeleteTarget = {
  id: string;
  projectId: string;
  name: string;
  status: string;
  endDate: Date | null;
};

type HardDeleteSummary = {
  linkedRecordsDetected: number;
  approvals: number;
  attachments: number;
  expenses: number;
  incomes: number;
  invoices: number;
  purchaseOrders: number;
  purchaseOrderItems: number;
  goodsReceipts: number;
  goodsReceiptItems: number;
  vendorBills: number;
  vendorBillLines: number;
  vendorPayments: number;
  vendorPaymentAllocations: number;
  inventoryLedger: number;
  quotations: number;
  quotationLineItems: number;
  incentives: number;
  commissions: number;
  journalEntries: number;
  journalLinesUnlinked: number;
  postingBatches: number;
  projectAssignments: number;
  projectTasks: number;
  auditLogs: number;
  project: number;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => String(v || "").trim()).filter(Boolean)));
}

function normalizeRoleName(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function isOwnerOrCeo(roleName: string | null | undefined) {
  const normalized = normalizeRoleName(roleName);
  return normalized === "owner" || normalized === "ceo";
}

async function hardDeleteProjectCascade(
  tx: Prisma.TransactionClient,
  project: ProjectDeleteTarget,
  aliases: string[],
): Promise<HardDeleteSummary> {
  const expenseRows = await tx.expense.findMany({
    where: { project: { in: aliases } },
    select: { id: true, inventoryLedgerId: true },
  });
  const incomeRows = await tx.income.findMany({
    where: { project: { in: aliases } },
    select: { id: true },
  });
  const invoiceRows = await tx.invoice.findMany({
    where: { projectId: { in: aliases } },
    select: { id: true },
  });
  const purchaseOrderRows = await tx.purchaseOrder.findMany({
    where: { projectRef: { in: aliases } },
    select: { id: true },
  });
  const purchaseOrderIds = purchaseOrderRows.map((row) => row.id);
  const goodsReceiptFilters: Prisma.GoodsReceiptWhereInput[] = [{ projectRef: { in: aliases } }];
  if (purchaseOrderIds.length > 0) {
    goodsReceiptFilters.push({ purchaseOrderId: { in: purchaseOrderIds } });
  }
  const goodsReceiptRows = await tx.goodsReceipt.findMany({
    where: { OR: goodsReceiptFilters },
    select: { id: true },
  });
  const goodsReceiptIds = goodsReceiptRows.map((row) => row.id);
  const goodsReceiptItemRows =
    goodsReceiptIds.length > 0
      ? await tx.goodsReceiptItem.findMany({
          where: { goodsReceiptId: { in: goodsReceiptIds } },
          select: { id: true },
        })
      : [];
  const goodsReceiptItemIds = goodsReceiptItemRows.map((row) => row.id);
  const vendorBillRows = await tx.vendorBill.findMany({
    where: { projectRef: { in: aliases } },
    select: { id: true },
  });
  const vendorBillIds = vendorBillRows.map((row) => row.id);
  const vendorPaymentRows = await tx.vendorPayment.findMany({
    where: { projectRef: { in: aliases } },
    select: { id: true },
  });
  const vendorPaymentIds = vendorPaymentRows.map((row) => row.id);
  const quotationRows = await tx.quotation.findMany({
    where: { projectRef: { in: aliases } },
    select: { id: true },
  });
  const quotationIds = quotationRows.map((row) => row.id);

  const expenseIds = expenseRows.map((row) => row.id);
  const incomeIds = incomeRows.map((row) => row.id);
  const invoiceIds = invoiceRows.map((row) => row.id);
  const expenseInventoryLedgerIds = uniqueStrings(expenseRows.map((row) => row.inventoryLedgerId));

  const inventoryLedgerFilters: Prisma.InventoryLedgerWhereInput[] = [{ project: { in: aliases } }];
  if (expenseInventoryLedgerIds.length > 0) {
    inventoryLedgerFilters.push({ id: { in: expenseInventoryLedgerIds } });
  }
  if (goodsReceiptIds.length > 0) {
    inventoryLedgerFilters.push({ sourceType: "GRN", sourceId: { in: goodsReceiptIds } });
  }
  const inventoryLedgerRows = await tx.inventoryLedger.findMany({
    where: { OR: inventoryLedgerFilters },
    select: { id: true, itemId: true },
  });
  const inventoryLedgerIds = inventoryLedgerRows.map((row) => row.id);
  const affectedInventoryItemIds = uniqueStrings(inventoryLedgerRows.map((row) => row.itemId));

  const sourceIds = uniqueStrings([
    ...expenseIds,
    ...incomeIds,
    ...invoiceIds,
    ...goodsReceiptIds,
    ...vendorBillIds,
    ...vendorPaymentIds,
    ...inventoryLedgerIds,
  ]);

  const journalRowsBySource =
    sourceIds.length > 0
      ? await tx.journalEntry.findMany({
          where: { sourceId: { in: sourceIds } },
          select: { id: true, batchId: true },
        })
      : [];
  const projectManualJournalRows = await tx.journalEntry.findMany({
    where: {
      sourceId: null,
      lines: { some: { projectId: project.id } },
    },
    select: {
      id: true,
      batchId: true,
      lines: { select: { projectId: true } },
    },
  });
  const projectOnlyManualJournalRows = projectManualJournalRows.filter((entry) =>
    entry.lines.every((line) => line.projectId === project.id),
  );
  const journalIds = uniqueStrings([
    ...journalRowsBySource.map((row) => row.id),
    ...projectOnlyManualJournalRows.map((row) => row.id),
  ]);
  const postingBatchIds = uniqueStrings([
    ...journalRowsBySource.map((row) => row.batchId),
    ...projectOnlyManualJournalRows.map((row) => row.batchId),
  ]);

  let deletedJournalEntries = 0;
  if (journalIds.length > 0) {
    deletedJournalEntries = (await tx.journalEntry.deleteMany({ where: { id: { in: journalIds } } })).count;
  }
  const unlinkedJournalLines = await tx.journalLine.updateMany({
    where: { projectId: project.id },
    data: { projectId: null },
  });
  let deletedPostingBatches = 0;
  if (postingBatchIds.length > 0) {
    deletedPostingBatches = (
      await tx.postingBatch.deleteMany({
        where: {
          id: { in: postingBatchIds },
          journals: { none: {} },
        },
      })
    ).count;
  }

  const approvalFilters: Prisma.ApprovalWhereInput[] = [];
  if (expenseIds.length > 0) {
    approvalFilters.push({ expenseId: { in: expenseIds } });
  }
  if (incomeIds.length > 0) {
    approvalFilters.push({ incomeId: { in: incomeIds } });
  }
  let deletedApprovals = 0;
  if (approvalFilters.length > 0) {
    deletedApprovals = (await tx.approval.deleteMany({ where: { OR: approvalFilters } })).count;
  }

  const attachmentRecordIds = uniqueStrings([
    project.id,
    ...expenseIds,
    ...incomeIds,
    ...invoiceIds,
    ...purchaseOrderIds,
    ...goodsReceiptIds,
    ...vendorBillIds,
    ...vendorPaymentIds,
    ...quotationIds,
  ]);
  let deletedAttachments = 0;
  if (attachmentRecordIds.length > 0) {
    deletedAttachments = (await tx.attachment.deleteMany({ where: { recordId: { in: attachmentRecordIds } } })).count;
  }

  const paymentAllocationFilters: Prisma.VendorPaymentAllocationWhereInput[] = [];
  if (vendorPaymentIds.length > 0) {
    paymentAllocationFilters.push({ vendorPaymentId: { in: vendorPaymentIds } });
  }
  if (vendorBillIds.length > 0) {
    paymentAllocationFilters.push({ vendorBillId: { in: vendorBillIds } });
  }
  let deletedVendorPaymentAllocations = 0;
  if (paymentAllocationFilters.length > 0) {
    deletedVendorPaymentAllocations = (
      await tx.vendorPaymentAllocation.deleteMany({ where: { OR: paymentAllocationFilters } })
    ).count;
  }

  const vendorBillLineFilters: Prisma.VendorBillLineWhereInput[] = [];
  if (vendorBillIds.length > 0) {
    vendorBillLineFilters.push({ vendorBillId: { in: vendorBillIds } });
  }
  if (goodsReceiptItemIds.length > 0) {
    vendorBillLineFilters.push({ grnItemId: { in: goodsReceiptItemIds } });
  }
  let deletedVendorBillLines = 0;
  if (vendorBillLineFilters.length > 0) {
    deletedVendorBillLines = (await tx.vendorBillLine.deleteMany({ where: { OR: vendorBillLineFilters } })).count;
  }

  let deletedGoodsReceiptItems = 0;
  if (goodsReceiptIds.length > 0) {
    deletedGoodsReceiptItems = (
      await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: { in: goodsReceiptIds } } })
    ).count;
  }

  let deletedPurchaseOrderItems = 0;
  if (purchaseOrderIds.length > 0) {
    deletedPurchaseOrderItems = (
      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: purchaseOrderIds } } })
    ).count;
  }

  let deletedVendorPayments = 0;
  if (vendorPaymentIds.length > 0) {
    deletedVendorPayments = (await tx.vendorPayment.deleteMany({ where: { id: { in: vendorPaymentIds } } })).count;
  }

  let deletedVendorBills = 0;
  if (vendorBillIds.length > 0) {
    deletedVendorBills = (await tx.vendorBill.deleteMany({ where: { id: { in: vendorBillIds } } })).count;
  }

  let deletedGoodsReceipts = 0;
  if (goodsReceiptIds.length > 0) {
    deletedGoodsReceipts = (await tx.goodsReceipt.deleteMany({ where: { id: { in: goodsReceiptIds } } })).count;
  }

  let deletedPurchaseOrders = 0;
  if (purchaseOrderIds.length > 0) {
    deletedPurchaseOrders = (await tx.purchaseOrder.deleteMany({ where: { id: { in: purchaseOrderIds } } })).count;
  }

  let deletedQuotationLineItems = 0;
  let deletedQuotations = 0;
  if (quotationIds.length > 0) {
    deletedQuotationLineItems = (
      await tx.quotationLineItem.deleteMany({ where: { quotationId: { in: quotationIds } } })
    ).count;
    deletedQuotations = (await tx.quotation.deleteMany({ where: { id: { in: quotationIds } } })).count;
  }

  const deletedIncentives = (await tx.incentiveEntry.deleteMany({ where: { projectRef: { in: aliases } } })).count;
  const deletedCommissions = (await tx.commissionEntry.deleteMany({ where: { projectRef: { in: aliases } } })).count;

  let deletedInvoices = 0;
  if (invoiceIds.length > 0) {
    deletedInvoices = (await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } })).count;
  }
  let deletedIncomes = 0;
  if (incomeIds.length > 0) {
    deletedIncomes = (await tx.income.deleteMany({ where: { id: { in: incomeIds } } })).count;
  }
  let deletedExpenses = 0;
  if (expenseIds.length > 0) {
    deletedExpenses = (await tx.expense.deleteMany({ where: { id: { in: expenseIds } } })).count;
  }

  let deletedInventoryLedger = 0;
  if (inventoryLedgerIds.length > 0) {
    deletedInventoryLedger = (await tx.inventoryLedger.deleteMany({ where: { id: { in: inventoryLedgerIds } } })).count;
  }

  for (const itemId of affectedInventoryItemIds) {
    const [item, quantityAgg] = await Promise.all([
      tx.inventoryItem.findUnique({
        where: { id: itemId },
        select: { id: true, unitCost: true, reservedQty: true },
      }),
      tx.inventoryLedger.aggregate({
        where: { itemId },
        _sum: { quantity: true },
      }),
    ]);
    if (!item) continue;
    const qty = Number(quantityAgg._sum.quantity || 0);
    const reserved = Number(item.reservedQty || 0);
    const unitCost = Number(item.unitCost || 0);
    await tx.inventoryItem.update({
      where: { id: itemId },
      data: {
        quantity: new Prisma.Decimal(qty),
        availableQty: new Prisma.Decimal(qty - reserved),
        totalValue: new Prisma.Decimal(qty * unitCost),
        lastUpdated: new Date(),
      },
    });
  }

  const deletedProjectAssignments = (await tx.projectAssignment.deleteMany({ where: { projectId: project.id } })).count;
  const deletedProjectTasks = (await tx.projectTask.deleteMany({ where: { projectId: project.id } })).count;

  const auditEntityIds = uniqueStrings([
    project.id,
    ...sourceIds,
    ...purchaseOrderIds,
    ...goodsReceiptItemIds,
    ...quotationIds,
  ]);
  let deletedAuditLogs = 0;
  if (auditEntityIds.length > 0) {
    deletedAuditLogs = (await tx.auditLog.deleteMany({ where: { entityId: { in: auditEntityIds } } })).count;
  }

  await tx.project.delete({ where: { id: project.id } });

  return {
    linkedRecordsDetected:
      expenseIds.length +
      incomeIds.length +
      invoiceIds.length +
      purchaseOrderIds.length +
      goodsReceiptIds.length +
      vendorBillIds.length +
      vendorPaymentIds.length +
      inventoryLedgerIds.length,
    approvals: deletedApprovals,
    attachments: deletedAttachments,
    expenses: deletedExpenses,
    incomes: deletedIncomes,
    invoices: deletedInvoices,
    purchaseOrders: deletedPurchaseOrders,
    purchaseOrderItems: deletedPurchaseOrderItems,
    goodsReceipts: deletedGoodsReceipts,
    goodsReceiptItems: deletedGoodsReceiptItems,
    vendorBills: deletedVendorBills,
    vendorBillLines: deletedVendorBillLines,
    vendorPayments: deletedVendorPayments,
    vendorPaymentAllocations: deletedVendorPaymentAllocations,
    inventoryLedger: deletedInventoryLedger,
    quotations: deletedQuotations,
    quotationLineItems: deletedQuotationLineItems,
    incentives: deletedIncentives,
    commissions: deletedCommissions,
    journalEntries: deletedJournalEntries,
    journalLinesUnlinked: unlinkedJournalLines.count,
    postingBatches: deletedPostingBatches,
    projectAssignments: deletedProjectAssignments,
    projectTasks: deletedProjectTasks,
    auditLogs: deletedAuditLogs,
    project: 1,
  };
}

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
