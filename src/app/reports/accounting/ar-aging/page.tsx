import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { getArAging } from "@/lib/accounting-reports";
import QueryInput from "@/components/QueryInput";

export default async function AraPage({
  searchParams,
}: {
  searchParams: {
    asOf?: string;
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
        <h1 className="text-2xl font-semibold">AR Aging</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const asOf = (searchParams.asOf || "").trim();
  const canExport = await requirePermission(session.user.id, "reports.export");
  const data = await getArAging({ asOf });
  const query = new URLSearchParams();
  if (asOf) query.set("asOf", asOf);
  const exportQuery = query.toString();

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">AR Aging</h1>
            <p className="mt-2 text-muted-foreground">
              Receivables aging based on invoices and approved/paid receipts allocations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <QueryInput param="asOf" placeholder="asOf=YYYY-MM-DD" />
            </div>
            {canExport ? (
              <a
                href={`/api/reports/accounting/ar-aging/export${exportQuery ? `?${exportQuery}` : ""}`}
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
          <div className="text-sm text-muted-foreground">Total Outstanding</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(data.totals.outstanding)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Current</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(data.totals.current)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">1-30</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(data.totals.bucket1to30)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">31-60</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(data.totals.bucket31to60)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Invoice #</th>
                <th className="py-2">Project</th>
                <th className="py-2">Invoice Date</th>
                <th className="py-2">Due Date</th>
                <th className="py-2">Outstanding</th>
                <th className="py-2">Overdue Days</th>
                <th className="py-2">Bucket</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.invoiceId} className="border-b">
                  <td className="py-2 font-medium">{row.invoiceNo}</td>
                  <td className="py-2">{row.projectId}</td>
                  <td className="py-2">{row.invoiceDate}</td>
                  <td className="py-2">{row.dueDate}</td>
                  <td className="py-2">{formatMoney(row.outstandingAmount)}</td>
                  <td className="py-2">{row.overdueDays}</td>
                  <td className="py-2">{row.bucket}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No outstanding receivables found.</div>
        ) : null}
      </div>
    </div>
  );
}
