import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import { getCashForecast } from "@/lib/accounting-reports";
import QueryInput from "@/components/QueryInput";

export default async function CashForecastPage({
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
        <h1 className="text-2xl font-semibold">Cash Forecast</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const asOf = (searchParams.asOf || "").trim();
  const data = await getCashForecast({ asOf });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Cash Forecast</h1>
            <p className="mt-2 text-muted-foreground">
              14-day and 30-day expected receipts vs planned disbursements.
            </p>
          </div>
          <div className="min-w-[220px]">
            <QueryInput param="asOf" placeholder="asOf=YYYY-MM-DD" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data.windows.map((window) => (
          <div key={window.days} className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="text-sm text-muted-foreground">{window.days}-Day Window</div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Expected Receipts</span>
                <span className="font-medium text-emerald-600">{formatMoney(window.expectedReceipts)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Planned Disbursements</span>
                <span className="font-medium text-red-600">{formatMoney(window.plannedDisbursements)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2">
                <span>Net Forecast</span>
                <span className={`font-semibold ${window.netForecast >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatMoney(window.netForecast)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
