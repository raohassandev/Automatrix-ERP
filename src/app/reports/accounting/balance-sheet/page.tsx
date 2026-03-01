import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import DateRangePicker from "@/components/DateRangePicker";
import { getBalanceSheet } from "@/lib/accounting-reports";

export default async function BalanceSheetPage({
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
        <h1 className="text-2xl font-semibold">Balance Sheet</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from = (searchParams.from || "").trim();
  const to = (searchParams.to || "").trim();
  const { assetRows, liabilityRows, equityRows, totals } = await getBalanceSheet({ from, to });
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  const exportQuery = exportParams.toString();

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Balance Sheet</h1>
            <p className="mt-2 text-muted-foreground">Derived from posted journals (assets, liabilities, equity).</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker />
            {canExport ? (
              <a
                href={`/api/reports/accounting/balance-sheet/export${exportQuery ? `?${exportQuery}` : ""}`}
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
          <div className="text-sm text-muted-foreground">Total Assets</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.totalAssets)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Liabilities</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.totalLiabilities)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Equity</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.totalEquity)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Assets</h2>
          <div className="mt-3 space-y-1 text-sm">
            {assetRows.map((r) => (
              <div key={r.accountId} className="flex items-center justify-between gap-3 border-b py-1">
                <span>{r.code} - {r.name}</span>
                <span>{formatMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Liabilities</h2>
          <div className="mt-3 space-y-1 text-sm">
            {liabilityRows.map((r) => (
              <div key={r.accountId} className="flex items-center justify-between gap-3 border-b py-1">
                <span>{r.code} - {r.name}</span>
                <span>{formatMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Equity</h2>
          <div className="mt-3 space-y-1 text-sm">
            {equityRows.map((r) => (
              <div key={r.accountId} className="flex items-center justify-between gap-3 border-b py-1">
                <span>{r.code} - {r.name}</span>
                <span>{formatMoney(r.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span>Assets</span>
          <span>{formatMoney(totals.totalAssets)}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span>Liabilities + Equity</span>
          <span>{formatMoney(totals.liabilitiesPlusEquity)}</span>
        </div>
        <div className={`flex items-center justify-between text-sm mt-2 font-semibold ${Math.abs(totals.difference) <= 0.01 ? "text-emerald-600" : "text-red-600"}`}>
          <span>Difference</span>
          <span>{formatMoney(totals.difference)}</span>
        </div>
      </div>
    </div>
  );
}
