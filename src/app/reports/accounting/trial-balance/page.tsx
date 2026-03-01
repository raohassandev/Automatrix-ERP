import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import DateRangePicker from "@/components/DateRangePicker";
import SearchInput from "@/components/SearchInput";
import { getTrialBalanceRows } from "@/lib/accounting-reports";

export default async function TrialBalancePage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
    search?: string;
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
        <h1 className="text-2xl font-semibold">Trial Balance</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from = (searchParams.from || "").trim();
  const to = (searchParams.to || "").trim();
  const search = (searchParams.search || "").trim().toLowerCase();
  const canExport = await requirePermission(session.user.id, "reports.export");

  const rows = (await getTrialBalanceRows({ from, to }))
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

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (search) exportParams.set("search", search);
  const exportQuery = exportParams.toString();

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Trial Balance</h1>
            <p className="mt-2 text-muted-foreground">
              Double-entry movement trial balance from posted journals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateRangePicker />
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search account code/name/type..." />
            </div>
            {canExport ? (
              <a
                href={`/api/reports/accounting/trial-balance/export${exportQuery ? `?${exportQuery}` : ""}`}
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
          <div className="text-sm text-muted-foreground">Total Debit</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.debit)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Credit</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.credit)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Difference (Dr - Cr)</div>
          <div className={`mt-2 text-xl font-semibold ${Math.abs(totals.debit - totals.credit) <= 0.01 ? "text-emerald-600" : "text-red-600"}`}>
            {formatMoney(totals.debit - totals.credit)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Code</th>
                <th className="py-2">Account</th>
                <th className="py-2">Type</th>
                <th className="py-2">Debit</th>
                <th className="py-2">Credit</th>
                <th className="py-2">Balance (Dr - Cr)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.accountId} className="border-b">
                  <td className="py-2 font-medium">{row.code}</td>
                  <td className="py-2">{row.name}</td>
                  <td className="py-2">{row.type}</td>
                  <td className="py-2">{formatMoney(row.debit)}</td>
                  <td className="py-2">{formatMoney(row.credit)}</td>
                  <td className={`py-2 ${Math.abs(row.balance) > 0.01 ? "font-medium" : ""}`}>
                    {formatMoney(row.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No posted journals found for the selected filters.</div>
        ) : null}
      </div>
    </div>
  );
}
