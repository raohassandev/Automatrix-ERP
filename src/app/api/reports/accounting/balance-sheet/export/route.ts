import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getBalanceSheet } from "@/lib/accounting-reports";
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
  const result = await getBalanceSheet({ from, to });

  const rows: Array<Array<string | number>> = [
    ["Section", "Code", "Account", "Amount"],
    ...result.assetRows.map((r) => ["Asset", r.code, r.name, r.amount.toFixed(2)]),
    ...result.liabilityRows.map((r) => ["Liability", r.code, r.name, r.amount.toFixed(2)]),
    ...result.equityRows.map((r) => ["Equity", r.code, r.name, r.amount.toFixed(2)]),
    ["", "", "Total Assets", result.totals.totalAssets.toFixed(2)],
    ["", "", "Total Liabilities", result.totals.totalLiabilities.toFixed(2)],
    ["", "", "Total Equity", result.totals.totalEquity.toFixed(2)],
    ["", "", "Liabilities + Equity", result.totals.liabilitiesPlusEquity.toFixed(2)],
    ["", "", "Difference", result.totals.difference.toFixed(2)],
  ];

  await logAudit({
    action: "EXPORT_BALANCE_SHEET_CSV",
    entity: "Export",
    entityId: "balance-sheet",
    newValue: JSON.stringify({ query: searchParams.toString() }),
    userId: session.user.id,
  });

  const csv = toCsv(rows);
  const filename = `balance_sheet_${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
