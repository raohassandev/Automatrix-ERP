import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import DateRangePicker from "@/components/DateRangePicker";
import { getCashPosition } from "@/lib/accounting-reports";

export default async function CashPositionPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
  };
}) {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Cash Position</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from = (searchParams.from || "").trim();
  const to = (searchParams.to || "").trim();
  const canExport = await requirePermission(session.user.id, "reports.export");
  const data = await getCashPosition({ from, to });
  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  const exportQuery = exportParams.toString();

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Cash Position</h1>
            <p className="mt-2 text-muted-foreground">
              Opening, inflow, outflow, and closing by company account.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            {canExport ? (
              <a
                href={`/api/reports/accounting/cash-position/export${exportQuery ? `?${exportQuery}` : ""}`}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Export CSV
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Opening</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(data.totals.opening)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Inflow</div>
          <div className="mt-2 text-xl font-semibold text-emerald-600">{formatMoney(data.totals.inflow)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Outflow</div>
          <div className="mt-2 text-xl font-semibold text-red-600">{formatMoney(data.totals.outflow)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Closing</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(data.totals.closing)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Company Account</th>
                <th className="py-2">Type</th>
                <th className="py-2">Opening</th>
                <th className="py-2">Inflow</th>
                <th className="py-2">Outflow</th>
                <th className="py-2">Closing</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.companyAccountId} className="border-b">
                  <td className="py-2 font-medium">{row.companyAccountName}</td>
                  <td className="py-2">{row.accountType}</td>
                  <td className="py-2">{formatMoney(row.opening)}</td>
                  <td className="py-2 text-emerald-600">{formatMoney(row.inflow)}</td>
                  <td className="py-2 text-red-600">{formatMoney(row.outflow)}</td>
                  <td className="py-2 font-medium">{formatMoney(row.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No company accounts found.</div>
        ) : null}
      </div>
    </div>
  );
}
