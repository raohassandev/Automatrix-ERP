import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import DateRangePicker from "@/components/DateRangePicker";
import { getProfitAndLoss } from "@/lib/accounting-reports";

export default async function ProfitLossPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");
  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  const canExport = await requirePermission(session.user.id, "reports.export");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Profit & Loss</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from = (searchParams.from || "").trim();
  const to = (searchParams.to || "").trim();
  const { revenueRows, expenseRows, totals } = await getProfitAndLoss({ from, to });
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  const exportQuery = exportParams.toString();

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Profit & Loss</h1>
            <p className="mt-2 text-muted-foreground">Derived from posted journals (income and expense GL accounts).</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker />
            {canExport ? (
              <a
                href={`/api/reports/accounting/profit-loss/export${exportQuery ? `?${exportQuery}` : ""}`}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Export CSV
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Revenue</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.totalRevenue)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Expense</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.totalExpense)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Net Profit</div>
          <div className={`mt-2 text-xl font-semibold ${totals.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatMoney(totals.netProfit)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Revenue</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Code</th>
                  <th className="py-2">Account</th>
                  <th className="py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {revenueRows.map((row) => (
                  <tr key={row.accountId} className="border-b">
                    <td className="py-2">{row.code}</td>
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{formatMoney(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Expenses</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Code</th>
                  <th className="py-2">Account</th>
                  <th className="py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.map((row) => (
                  <tr key={row.accountId} className="border-b">
                    <td className="py-2">{row.code}</td>
                    <td className="py-2">{row.name}</td>
                    <td className="py-2">{formatMoney(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
