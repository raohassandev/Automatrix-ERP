import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildProjectAliases, recalculateProjectFinancials } from "@/lib/projects";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

type LinkedRecordType =
  | "expense"
  | "income"
  | "invoice"
  | "purchaseOrder"
  | "goodsReceipt"
  | "vendorBill"
  | "vendorPayment"
  | "inventoryLedger"
  | "manualJournalLine"
  | "quotation"
  | "incentive"
  | "commission";

type LinkedRecordItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  amount?: number | null;
  date?: string | null;
};

type LinkedRecordGroup = {
  key: LinkedRecordType;
  label: string;
  actionLabel: string;
  items: LinkedRecordItem[];
};

type SessionLike = {
  user?: {
    id?: string | null;
    role?: string | { name?: string | null } | null;
  } | null;
} | null;

function roleNameFromSession(session: SessionLike) {
  const role = session?.user?.role;
  const roleName = typeof role === "string" ? role : role?.name || "";
  return String(roleName || "")
    .trim()
    .toLowerCase();
}

function isOwnerOrCeo(roleName: string | null | undefined) {
  const normalized = String(roleName || "").trim().toLowerCase();
  return normalized === "owner" || normalized === "ceo";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function toIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureOwnerOrCeo(session: SessionLike) {
  const roleFromToken = roleNameFromSession(session);
  if (isOwnerOrCeo(roleFromToken)) return true;
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: { select: { name: true } } },
  });
  return isOwnerOrCeo(user?.role?.name);
}

async function deleteJournalEntriesBySource(tx: Prisma.TransactionClient, sourceType: string, sourceId: string) {
  const rows = await tx.journalEntry.findMany({
    where: { sourceType, sourceId },
    select: { id: true, batchId: true },
  });
  if (rows.length === 0) return 0;
  const ids = rows.map((row) => row.id);
  const batchIds = uniqueStrings(rows.map((row) => row.batchId));
  await tx.journalEntry.deleteMany({ where: { id: { in: ids } } });
  if (batchIds.length > 0) {
    await tx.postingBatch.deleteMany({
      where: {
        id: { in: batchIds },
        journals: { none: {} },
      },
    });
  }
  return rows.length;
}

async function recalcInventoryItemFromLedger(tx: Prisma.TransactionClient, itemId: string) {
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
  if (!item) return;
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

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEditProject = await requirePermission(session.user.id, "projects.edit");
  if (!canEditProject) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, projectId: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  const aliases = buildProjectAliases(project);

  const [
    expenses,
    incomes,
    invoices,
    purchaseOrders,
    goodsReceipts,
    vendorBills,
    vendorPayments,
    inventoryLedger,
    manualJournalLines,
    quotations,
    incentives,
    commissions,
  ] = await Promise.all([
    prisma.expense.findMany({
      where: { project: { in: aliases } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        description: true,
        category: true,
        status: true,
        amount: true,
      },
    }),
    prisma.income.findMany({
      where: { project: { in: aliases } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        source: true,
        category: true,
        status: true,
        amount: true,
      },
    }),
    prisma.invoice.findMany({
      where: { projectId: { in: aliases } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        invoiceNo: true,
        date: true,
        status: true,
        amount: true,
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { projectRef: { in: aliases } },
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        poNumber: true,
        orderDate: true,
        status: true,
        totalAmount: true,
      },
    }),
    prisma.goodsReceipt.findMany({
      where: {
        OR: [{ projectRef: { in: aliases } }, { purchaseOrder: { projectRef: { in: aliases } } }],
      },
      orderBy: [{ receivedDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        grnNumber: true,
        receivedDate: true,
        status: true,
      },
    }),
    prisma.vendorBill.findMany({
      where: { projectRef: { in: aliases } },
      orderBy: [{ billDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        billNumber: true,
        billDate: true,
        status: true,
        totalAmount: true,
      },
    }),
    prisma.vendorPayment.findMany({
      where: { projectRef: { in: aliases } },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        status: true,
        amount: true,
      },
    }),
    prisma.inventoryLedger.findMany({
      where: { project: { in: aliases } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        type: true,
        reference: true,
        quantity: true,
        total: true,
        item: { select: { name: true } },
      },
    }),
    prisma.journalLine.findMany({
      where: { projectId: id },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        debit: true,
        credit: true,
        memo: true,
        journalEntry: {
          select: {
            id: true,
            voucherNo: true,
            postingDate: true,
            status: true,
            sourceType: true,
            sourceId: true,
          },
        },
      },
    }),
    prisma.quotation.findMany({
      where: { projectRef: { in: aliases } },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    }),
    prisma.incentiveEntry.findMany({
      where: { projectRef: { in: aliases } },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        employee: { select: { name: true } },
      },
    }),
    prisma.commissionEntry.findMany({
      where: { projectRef: { in: aliases } },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        employee: { select: { name: true } },
      },
    }),
  ]);

  const groups = ([
    {
      key: "expense",
      label: "Expenses",
      actionLabel: "Delete",
      items: expenses.map((row) => ({
        id: row.id,
        title: row.description,
        subtitle: row.category,
        status: row.status,
        amount: money(row.amount),
        date: toIsoDate(row.date),
      })),
    },
    {
      key: "income",
      label: "Income",
      actionLabel: "Delete",
      items: incomes.map((row) => ({
        id: row.id,
        title: row.source,
        subtitle: row.category,
        status: row.status,
        amount: money(row.amount),
        date: toIsoDate(row.date),
      })),
    },
    {
      key: "invoice",
      label: "Invoices",
      actionLabel: "Delete",
      items: invoices.map((row) => ({
        id: row.id,
        title: row.invoiceNo,
        subtitle: "Customer invoice",
        status: row.status,
        amount: money(row.amount),
        date: toIsoDate(row.date),
      })),
    },
    {
      key: "purchaseOrder",
      label: "Purchase Orders",
      actionLabel: "Delete",
      items: purchaseOrders.map((row) => ({
        id: row.id,
        title: row.poNumber,
        subtitle: "Procurement PO",
        status: row.status,
        amount: money(row.totalAmount),
        date: toIsoDate(row.orderDate),
      })),
    },
    {
      key: "goodsReceipt",
      label: "Goods Receipts",
      actionLabel: "Delete",
      items: goodsReceipts.map((row) => ({
        id: row.id,
        title: row.grnNumber,
        subtitle: "GRN",
        status: row.status,
        date: toIsoDate(row.receivedDate),
      })),
    },
    {
      key: "vendorBill",
      label: "Vendor Bills",
      actionLabel: "Delete",
      items: vendorBills.map((row) => ({
        id: row.id,
        title: row.billNumber,
        subtitle: "Payable bill",
        status: row.status,
        amount: money(row.totalAmount),
        date: toIsoDate(row.billDate),
      })),
    },
    {
      key: "vendorPayment",
      label: "Vendor Payments",
      actionLabel: "Delete",
      items: vendorPayments.map((row) => ({
        id: row.id,
        title: row.paymentNumber,
        subtitle: "Vendor payment",
        status: row.status,
        amount: money(row.amount),
        date: toIsoDate(row.paymentDate),
      })),
    },
    {
      key: "inventoryLedger",
      label: "Inventory Ledger",
      actionLabel: "Delete",
      items: inventoryLedger.map((row) => ({
        id: row.id,
        title: row.reference || `Ledger ${row.id.slice(0, 8)}`,
        subtitle: `${row.type} • ${row.item.name} • Qty ${money(row.quantity)}`,
        amount: money(row.total),
        date: toIsoDate(row.date),
      })),
    },
    {
      key: "manualJournalLine",
      label: "Manual Journal Links",
      actionLabel: "Unlink",
      items: manualJournalLines.map((row) => ({
        id: row.id,
        title: row.journalEntry.voucherNo || `Journal ${row.journalEntry.id.slice(0, 8)}`,
        subtitle:
          row.memo ||
          `${row.journalEntry.status} • ${row.journalEntry.sourceType || "manual"}${row.journalEntry.sourceId ? `:${row.journalEntry.sourceId}` : ""}`,
        amount: money(row.debit) || money(row.credit),
        date: toIsoDate(row.journalEntry.postingDate),
      })),
    },
    {
      key: "quotation",
      label: "Quotations",
      actionLabel: "Delete",
      items: quotations.map((row) => ({
        id: row.id,
        title: row.quoteNumber,
        subtitle: "Sales quotation",
        status: row.status,
        amount: money(row.totalAmount),
        date: toIsoDate(row.createdAt),
      })),
    },
    {
      key: "incentive",
      label: "Incentives",
      actionLabel: "Delete",
      items: incentives.map((row) => ({
        id: row.id,
        title: row.employee?.name || "Employee incentive",
        subtitle: "Incentive entry",
        status: row.status,
        amount: money(row.amount),
        date: toIsoDate(row.createdAt),
      })),
    },
    {
      key: "commission",
      label: "Commissions",
      actionLabel: "Delete",
      items: commissions.map((row) => ({
        id: row.id,
        title: row.employee?.name || "Employee commission",
        subtitle: "Commission entry",
        status: row.status,
        amount: money(row.amount),
        date: toIsoDate(row.createdAt),
      })),
    },
  ] satisfies LinkedRecordGroup[]).filter((group) => group.items.length > 0);

  const totalLinked = groups.reduce((sum, group) => sum + group.items.length, 0);

  return NextResponse.json({
    success: true,
    data: {
      project: {
        id: project.id,
        projectId: project.projectId,
        name: project.name,
      },
      totalLinked,
      groups: groups.map((group) => ({
        ...group,
        count: group.items.length,
      })),
    },
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const canEditProject = await requirePermission(session.user.id, "projects.edit");
  if (!canEditProject) {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const allowedRole = await ensureOwnerOrCeo(session);
  if (!allowedRole) {
    return NextResponse.json(
      {
        success: false,
        error: "Only CEO/Owner can permanently delete linked records for a project.",
      },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: { id: true, projectId: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
  }
  const aliases = buildProjectAliases(project);

  const body = await req.json().catch(() => ({}));
  const type = String((body as { type?: string }).type || "").trim() as LinkedRecordType;
  const recordId = String((body as { recordId?: string }).recordId || "").trim();
  if (!type || !recordId) {
    return NextResponse.json({ success: false, error: "type and recordId are required." }, { status: 400 });
  }

  let didFinancialMutation = false;

  try {
    await prisma.$transaction(async (tx) => {
      switch (type) {
        case "expense": {
          const record = await tx.expense.findFirst({
            where: { id: recordId, project: { in: aliases } },
            select: { id: true, inventoryLedgerId: true, project: true },
          });
          if (!record) throw new Error("Linked expense not found for this project.");
          await tx.approval.deleteMany({ where: { expenseId: record.id } });
          await deleteJournalEntriesBySource(tx, "EXPENSE", record.id);
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.expense.delete({ where: { id: record.id } });
          if (record.inventoryLedgerId) {
            const ledger = await tx.inventoryLedger.findUnique({
              where: { id: record.inventoryLedgerId },
              select: { id: true, itemId: true },
            });
            await tx.expense.updateMany({
              where: { inventoryLedgerId: record.inventoryLedgerId },
              data: { inventoryLedgerId: null },
            });
            if (ledger) {
              await tx.inventoryLedger.delete({ where: { id: ledger.id } });
              await recalcInventoryItemFromLedger(tx, ledger.itemId);
            }
          }
          didFinancialMutation = true;
          break;
        }
        case "income": {
          const record = await tx.income.findFirst({
            where: { id: recordId, project: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked income not found for this project.");
          await tx.approval.deleteMany({ where: { incomeId: record.id } });
          await deleteJournalEntriesBySource(tx, "INCOME", record.id);
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.income.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        case "invoice": {
          const record = await tx.invoice.findFirst({
            where: { id: recordId, projectId: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked invoice not found for this project.");
          await deleteJournalEntriesBySource(tx, "INVOICE", record.id);
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.invoice.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        case "purchaseOrder": {
          const record = await tx.purchaseOrder.findFirst({
            where: { id: recordId, projectRef: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked purchase order not found for this project.");
          const grnCount = await tx.goodsReceipt.count({ where: { purchaseOrderId: record.id } });
          if (grnCount > 0) {
            throw new Error("Delete linked GRNs for this PO first.");
          }
          await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: record.id } });
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.purchaseOrder.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        case "goodsReceipt": {
          const record = await tx.goodsReceipt.findFirst({
            where: {
              id: recordId,
              OR: [{ projectRef: { in: aliases } }, { purchaseOrder: { projectRef: { in: aliases } } }],
            },
            select: {
              id: true,
              items: { select: { id: true } },
            },
          });
          if (!record) throw new Error("Linked goods receipt not found for this project.");
          const grnItemIds = record.items.map((item) => item.id);
          if (grnItemIds.length > 0) {
            const linkedBillLines = await tx.vendorBillLine.count({ where: { grnItemId: { in: grnItemIds } } });
            if (linkedBillLines > 0) {
              throw new Error("Delete linked vendor bill lines (or bills) before deleting this GRN.");
            }
          }
          const stockRows = await tx.inventoryLedger.findMany({
            where: { sourceType: "GRN", sourceId: record.id },
            select: { id: true, itemId: true },
          });
          if (stockRows.length > 0) {
            await tx.inventoryLedger.deleteMany({
              where: { id: { in: stockRows.map((row) => row.id) } },
            });
            for (const row of stockRows) {
              await recalcInventoryItemFromLedger(tx, row.itemId);
            }
          }
          await tx.goodsReceiptItem.deleteMany({ where: { goodsReceiptId: record.id } });
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.goodsReceipt.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        case "vendorBill": {
          const record = await tx.vendorBill.findFirst({
            where: { id: recordId, projectRef: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked vendor bill not found for this project.");
          const allocCount = await tx.vendorPaymentAllocation.count({ where: { vendorBillId: record.id } });
          if (allocCount > 0) {
            throw new Error("Delete linked vendor payment allocations first.");
          }
          await deleteJournalEntriesBySource(tx, "VENDOR_BILL", record.id);
          await tx.vendorBillLine.deleteMany({ where: { vendorBillId: record.id } });
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.vendorBill.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        case "vendorPayment": {
          const record = await tx.vendorPayment.findFirst({
            where: { id: recordId, projectRef: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked vendor payment not found for this project.");
          await tx.vendorPaymentAllocation.deleteMany({ where: { vendorPaymentId: record.id } });
          await deleteJournalEntriesBySource(tx, "VENDOR_PAYMENT", record.id);
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.vendorPayment.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        case "inventoryLedger": {
          const record = await tx.inventoryLedger.findFirst({
            where: { id: recordId, project: { in: aliases } },
            select: { id: true, itemId: true },
          });
          if (!record) throw new Error("Linked inventory ledger entry not found for this project.");
          await tx.expense.updateMany({
            where: { inventoryLedgerId: record.id },
            data: { inventoryLedgerId: null },
          });
          await tx.inventoryLedger.delete({ where: { id: record.id } });
          await recalcInventoryItemFromLedger(tx, record.itemId);
          didFinancialMutation = true;
          break;
        }
        case "manualJournalLine": {
          const record = await tx.journalLine.findFirst({
            where: { id: recordId, projectId: project.id },
            select: { id: true },
          });
          if (!record) throw new Error("Linked manual journal line not found for this project.");
          await tx.journalLine.update({
            where: { id: record.id },
            data: { projectId: null },
          });
          didFinancialMutation = true;
          break;
        }
        case "quotation": {
          const record = await tx.quotation.findFirst({
            where: { id: recordId, projectRef: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked quotation not found for this project.");
          await tx.quotationLineItem.deleteMany({ where: { quotationId: record.id } });
          await tx.attachment.deleteMany({ where: { recordId: record.id } });
          await tx.quotation.delete({ where: { id: record.id } });
          break;
        }
        case "incentive": {
          const record = await tx.incentiveEntry.findFirst({
            where: { id: recordId, projectRef: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked incentive not found for this project.");
          await tx.incentiveEntry.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        case "commission": {
          const record = await tx.commissionEntry.findFirst({
            where: { id: recordId, projectRef: { in: aliases } },
            select: { id: true },
          });
          if (!record) throw new Error("Linked commission not found for this project.");
          await tx.commissionEntry.delete({ where: { id: record.id } });
          didFinancialMutation = true;
          break;
        }
        default:
          throw new Error("Unsupported linked record type.");
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete linked record";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  if (didFinancialMutation) {
    await recalculateProjectFinancials(project.projectId);
  }

  await logAudit({
    action: "DELETE_LINKED_PROJECT_RECORD",
    entity: "Project",
    entityId: project.id,
    reason: `Deleted linked record ${type}:${recordId}`,
    userId: session.user.id,
  });

  return NextResponse.json({
    success: true,
    data: {
      type,
      recordId,
      deleted: true,
    },
  });
}
