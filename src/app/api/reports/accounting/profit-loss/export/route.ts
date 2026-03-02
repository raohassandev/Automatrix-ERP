import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getProfitAndLoss } from "@/lib/accounting-reports";
import { canAccessAccountingReports } from "@/lib/accounting-report-access";

function toCsv(rows: Array<Array<string | number | null | undefined>>) {
  return rows
    .map((row) =>
      row
        .map((field) => {
          const value = field ?? "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const canExport = await requirePermission(session.user.id, "reports.export");
  const canView = await canAccessAccountingReports(session.user.id);
  if (!canExport || !canView) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const result = await getProfitAndLoss({ from, to });

  const rows: Array<Array<string | number>> = [
    ["Section", "Code", "Account", "Amount"],
    ...result.revenueRows.map((r) => ["Revenue", r.code, r.name, r.amount.toFixed(2)]),
    ...result.expenseRows.map((r) => ["Expense", r.code, r.name, r.amount.toFixed(2)]),
    ["", "", "Total Revenue", result.totals.totalRevenue.toFixed(2)],
    ["", "", "Total Expense", result.totals.totalExpense.toFixed(2)],
    ["", "", "Net Profit", result.totals.netProfit.toFixed(2)],
  ];

  await logAudit({
    action: "EXPORT_PROFIT_LOSS_CSV",
    entity: "Export",
    entityId: "profit-loss",
    newValue: JSON.stringify({ query: searchParams.toString() }),
    userId: session.user.id,
  });

  const csv = toCsv(rows);
  const filename = `profit_loss_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
