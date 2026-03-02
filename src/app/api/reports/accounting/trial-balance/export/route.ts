import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getTrialBalanceRows } from "@/lib/accounting-reports";
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
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const canExport = await requirePermission(session.user.id, "reports.export");
  const canView = await canAccessAccountingReports(session.user.id);
  if (!canExport || !canView) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const search = (searchParams.get("search") || "").trim().toLowerCase();

  const rows = (await getTrialBalanceRows({ from, to }))
    .map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
      debit: row.debit,
      credit: row.credit,
      balance: row.balance,
    }))
    .filter((row) => {
      if (!search) return true;
      return (
        row.code.toLowerCase().includes(search) ||
        row.name.toLowerCase().includes(search) ||
        row.type.toLowerCase().includes(search)
      );
    });

  const totals = rows.reduce(
    (acc, row) => {
      acc.debit += row.debit;
      acc.credit += row.credit;
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  await logAudit({
    action: "EXPORT_TRIAL_BALANCE_CSV",
    entity: "Export",
    entityId: "trial-balance",
    newValue: JSON.stringify({ route: "/api/reports/accounting/trial-balance/export", query: searchParams.toString() }),
    userId: session.user.id,
  });

  const csvRows: Array<Array<string | number>> = [
    ["Account Code", "Account Name", "Type", "Debit", "Credit", "Balance (Dr-Cr)"],
    ...rows.map((row) => [
      row.code,
      row.name,
      row.type,
      row.debit.toFixed(2),
      row.credit.toFixed(2),
      row.balance.toFixed(2),
    ]),
    ["", "", "TOTAL", totals.debit.toFixed(2), totals.credit.toFixed(2), (totals.debit - totals.credit).toFixed(2)],
  ];

  const csv = toCsv(csvRows);
  const filename = `trial_balance_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
