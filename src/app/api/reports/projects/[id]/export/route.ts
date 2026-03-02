import { auth } from "@/lib/auth";
import { getProjectDetailForUser } from "@/lib/project-detail-policy";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { formatMoney } from "@/lib/format";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
}

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canExport = await requirePermission(session.user.id, "reports.export");
  if (!canExport) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await context.params;
  const detailResult = await getProjectDetailForUser({ userId: session.user.id, projectDbId: id });
  if (!detailResult.ok) {
    return new Response(detailResult.error, { status: detailResult.status });
  }

  if (!detailResult.data.policy.canViewFinancialTotals || !detailResult.data.costs) {
    return new Response("Forbidden", { status: 403 });
  }

  const financialRows = detailResult.data.activity
    .filter((row) => row.type === "INCOME" || row.type === "EXPENSE" || row.type === "BILL" || row.type === "PAYMENT")
    .map((row) => [
      new Date(row.at).toISOString(),
      row.type,
      row.label,
      row.status || "",
      row.amount != null ? Number(row.amount) : "",
      row.href || "",
    ]);

  const csvRows: Array<Array<string | number | null | undefined>> = [
    ["Project", detailResult.data.header.name],
    ["Project ID", detailResult.data.header.projectId],
    ["Client", detailResult.data.header.client.name],
    ["Status", detailResult.data.header.status],
    [],
    ["Contract Value", formatMoney(detailResult.data.costs.contractValue)],
    ["Invoiced Amount", formatMoney(detailResult.data.costs.invoicedAmount)],
    ["Received Amount", formatMoney(detailResult.data.costs.receivedAmount)],
    ["Cost To Date", formatMoney(detailResult.data.costs.costToDate)],
    ["Gross Margin", formatMoney(detailResult.data.costs.grossMargin)],
    ["Margin %", `${detailResult.data.costs.marginPercent.toFixed(2)}%`],
    ["Pending Recovery", formatMoney(detailResult.data.costs.pendingRecovery)],
    ["Overdue Recovery", formatMoney(detailResult.data.costs.risk.overdueRecoveryAmount)],
    ["Overdue Invoice Count", detailResult.data.costs.risk.overdueInvoiceCount],
    [],
    ["AP Billed (posted)", formatMoney(detailResult.data.costs.apBilledTotal)],
    ["AP Paid (posted allocations)", formatMoney(detailResult.data.costs.apPaidTotal)],
    ["AP Outstanding", formatMoney(detailResult.data.costs.apOutstanding)],
    ["Approved Income", formatMoney(detailResult.data.costs.approvedIncomeReceived)],
    ["Approved Incentives", formatMoney(detailResult.data.costs.incentivesApproved)],
    ["Approved Other Non-Stock Expenses", formatMoney(detailResult.data.costs.otherNonStockExpensesApproved)],
    ["Approved Non-Stock Expenses (Total)", formatMoney(detailResult.data.costs.nonStockExpensesApproved)],
    ["Pending Income", formatMoney(detailResult.data.costs.pendingIncomeSubmitted)],
    ["Pending Expense", formatMoney(detailResult.data.costs.pendingExpenseSubmitted)],
    ["Total Project Costs", formatMoney(detailResult.data.costs.totalProjectCosts)],
    ["Project Profit", formatMoney(detailResult.data.costs.projectProfit)],
    [],
    ["Date", "Type", "Reference", "Status", "Amount", "Link"],
    ...financialRows,
  ];

  await logAudit({
    action: "EXPORT_PROJECT_FINANCE_CSV",
    entity: "Project",
    entityId: id,
    newValue: JSON.stringify({
      route: "/api/reports/projects/[id]/export",
      transactions: financialRows.length,
      projectId: detailResult.data.header.projectId,
    }),
    userId: session.user.id,
  });

  const csv = toCsv(csvRows);
  const safeProjectId = detailResult.data.header.projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `project_finance_${safeProjectId}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
