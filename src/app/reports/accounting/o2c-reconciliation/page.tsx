import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import QueryInput from "@/components/QueryInput";
import { getO2cReconciliation } from "@/lib/accounting-reports";
import { formatMoney } from "@/lib/format";

export default async function O2cReconciliationPage({
  searchParams,
}: {
  searchParams: {
    from?: string;
    to?: string;
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
        <h1 className="text-2xl font-semibold">O2C Reconciliation</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const from = (searchParams.from || "").trim();
  const to = (searchParams.to || "").trim();
  const asOf = (searchParams.asOf || "").trim();
  const data = await getO2cReconciliation({ from, to, asOf });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">O2C Reconciliation</h1>
            <p className="mt-2 text-muted-foreground">
              Track invoice-to-receipt matching and fix allocation exceptions before period close.
            </p>
          </div>
          <div className="flex min-w-[220px] flex-wrap gap-2">
            <QueryInput param="from" placeholder="from=YYYY-MM-DD" />
            <QueryInput param="to" placeholder="to=YYYY-MM-DD" />
            <QueryInput param="asOf" placeholder="asOf=YYYY-MM-DD" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <div className="text-sm text-emerald-700">Invoiced</div>
          <div className="mt-2 text-xl font-semibold text-emerald-900">{formatMoney(data.totals.invoiced)}</div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-6 shadow-sm">
          <div className="text-sm text-sky-700">Received</div>
          <div className="mt-2 text-xl font-semibold text-sky-900">{formatMoney(data.totals.received)}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="text-sm text-amber-700">Outstanding</div>
          <div className="mt-2 text-xl font-semibold text-amber-900">{formatMoney(data.totals.outstanding)}</div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
          <div className="text-sm text-rose-700">Exceptions</div>
          <div className="mt-2 text-xl font-semibold text-rose-900">{data.totals.exceptionCount}</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Unallocated receipts</div>
          <div className="mt-1 text-lg font-semibold text-rose-600">{data.totals.unallocatedReceiptCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Orphan allocations</div>
          <div className="mt-1 text-lg font-semibold text-rose-600">{data.totals.orphanAllocationCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Project mismatches</div>
          <div className="mt-1 text-lg font-semibold text-rose-600">{data.totals.projectMismatchCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="text-xs text-muted-foreground">Over-allocated invoices</div>
          <div className="mt-1 text-lg font-semibold text-rose-600">{data.totals.overAllocatedCount}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Invoice Matching Status</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Invoice #</th>
                <th className="py-2">Project</th>
                <th className="py-2">Invoiced</th>
                <th className="py-2">Received</th>
                <th className="py-2">Outstanding</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.invoiceId} className="border-b">
                  <td className="py-2 font-medium">{row.invoiceNo}</td>
                  <td className="py-2">{row.projectId}</td>
                  <td className="py-2">{formatMoney(row.totalAmount)}</td>
                  <td className="py-2">{formatMoney(row.receivedAmount)}</td>
                  <td className="py-2">{formatMoney(row.outstandingAmount)}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        row.status === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.status === "OPEN"
                            ? "bg-sky-100 text-sky-700"
                            : row.status === "OVERDUE"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No invoice data found for selected range.</div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Receipt Exceptions</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Income ID</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Type</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {data.receiptExceptions.map((row) => (
                <tr key={`${row.type}:${row.incomeId}`} className="border-b">
                  <td className="py-2">{row.date}</td>
                  <td className="py-2 font-medium">{row.incomeId}</td>
                  <td className="py-2">{formatMoney(row.amount)}</td>
                  <td className="py-2">
                    <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-medium text-rose-700">{row.type}</span>
                  </td>
                  <td className="py-2">{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.receiptExceptions.length === 0 ? (
          <div className="py-8 text-center text-emerald-700">No O2C receipt exceptions found.</div>
        ) : null}
      </div>
    </div>
  );
}
