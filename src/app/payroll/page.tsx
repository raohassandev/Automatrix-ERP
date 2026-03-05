import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import PaginationControls from "@/components/PaginationControls";
import { PayrollRunCreateButton } from "@/components/PayrollRunCreateButton";
import { PayrollRunActions } from "@/components/PayrollRunActions";
import { StatusBadge } from "@/components/StatusBadge";
import { MobileCard } from "@/components/MobileCard";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canView = await requirePermission(session.user.id, "payroll.view_all");
  const canEdit = await requirePermission(session.user.id, "payroll.edit");
  const canApprove = await requirePermission(session.user.id, "payroll.approve");
  if (!canView && !canEdit && !canApprove) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to payroll.</p>
      </div>
    );
  }

  const params = searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 20;
  const skip = (page - 1) * take;

  const [runs, total, employees, pendingIncentivePayrollAgg, settledIncentivePayrollAgg, openSalaryAdvanceAgg] =
    await Promise.all([
    prisma.payrollRun.findMany({
      orderBy: { periodStart: "desc" },
      include: { entries: true },
      skip,
      take,
    }),
    prisma.payrollRun.count(),
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.incentiveEntry.aggregate({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "UNSETTLED",
        status: { in: ["PENDING", "APPROVED"] },
      },
      _sum: { amount: true },
    }),
    prisma.incentiveEntry.aggregate({
      where: {
        payoutMode: "PAYROLL",
        settlementStatus: "SETTLED",
        status: "APPROVED",
      },
      _sum: { amount: true },
    }),
    prisma.salaryAdvance.aggregate({
      where: { status: "OPEN" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));
  const summary = runs.reduce(
    (acc, run) => {
      const net = run.entries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
      acc.totalNet += net;
      acc.totalEntries += run.entries.length;
      if (run.status === "APPROVED" || run.status === "POSTED") acc.approvedRuns += 1;
      return acc;
    },
    { totalNet: 0, totalEntries: 0, approvedRuns: 0 },
  );
  const pendingIncentivePayroll = Number(pendingIncentivePayrollAgg._sum.amount || 0);
  const settledIncentivePayroll = Number(settledIncentivePayrollAgg._sum.amount || 0);
  const openSalaryAdvance = Number(openSalaryAdvanceAgg._sum.amount || 0);
  const openSalaryAdvanceCount = Number(openSalaryAdvanceAgg._count._all || 0);

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Payroll</h1>
            <p className="mt-2 text-muted-foreground">Manage pay periods and wallet credits.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit ? <PayrollRunCreateButton employees={employees} /> : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/incentives"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Incentives
          </a>
          <a
            href="/salary-advances"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Salary Advances
          </a>
          <a
            href="/reports/employee-expenses"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Employee Expense Report
          </a>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900/60 dark:bg-sky-950/30">
            <div className="text-sm text-sky-700 dark:text-sky-300">Runs on this page</div>
            <div className="text-xl font-semibold text-sky-800 dark:text-sky-100">{runs.length}</div>
          </div>
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30">
            <div className="text-sm text-indigo-700 dark:text-indigo-300">Payroll Entries</div>
            <div className="text-xl font-semibold text-indigo-800 dark:text-indigo-100">{summary.totalEntries}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Net Pay</div>
            <div className="text-xl font-semibold text-emerald-800 dark:text-emerald-100">{formatMoney(summary.totalNet)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="text-sm text-amber-700 dark:text-amber-300">Approved/Posted</div>
            <div className="text-xl font-semibold text-amber-800 dark:text-amber-100">{summary.approvedRuns}</div>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/30">
            <div className="text-sm text-violet-700 dark:text-violet-300">Incentive Pending (Payroll)</div>
            <div className="text-xl font-semibold text-violet-800 dark:text-violet-100">{formatMoney(pendingIncentivePayroll)}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
            <div className="text-sm text-emerald-700 dark:text-emerald-300">Incentive Settled (Payroll)</div>
            <div className="text-xl font-semibold text-emerald-800 dark:text-emerald-100">{formatMoney(settledIncentivePayroll)}</div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
            <div className="text-sm text-rose-700 dark:text-rose-300">Open Salary Advances</div>
            <div className="text-xl font-semibold text-rose-800 dark:text-rose-100">{formatMoney(openSalaryAdvance)}</div>
            <div className="text-xs text-rose-700/80 dark:text-rose-300/80">{openSalaryAdvanceCount} employee advance(s)</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Period</th>
                <th className="py-2">Entries</th>
                <th className="py-2">Total Net</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const totalNet = run.entries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
                return (
                  <tr key={run.id} className="border-b">
                    <td className="py-2">
                      {new Date(run.periodStart).toLocaleDateString()} -{" "}
                      {new Date(run.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="py-2">{run.entries.length}</td>
                    <td className="py-2">{formatMoney(totalNet)}</td>
                    <td className="py-2">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2">
                      {canEdit ? (
                        <PayrollRunActions
                          run={{
                            id: run.id,
                            periodStart: run.periodStart.toISOString(),
                            periodEnd: run.periodEnd.toISOString(),
                            status: run.status,
                            notes: run.notes,
                            entries: run.entries.map((entry) => ({
                              employeeId: entry.employeeId,
                              baseSalary: Number(entry.baseSalary),
                              incentiveTotal: Number(entry.incentiveTotal),
                              deductions: Number(entry.deductions),
                              deductionReason: entry.deductionReason || "",
                            })),
                          }}
                          employees={employees}
                          canApprove={canApprove}
                        />
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {runs.map((run) => {
            const totalNet = run.entries.reduce((sum, entry) => sum + Number(entry.netPay), 0);
            return (
              <MobileCard
                key={run.id}
                title={`${new Date(run.periodStart).toLocaleDateString()} - ${new Date(run.periodEnd).toLocaleDateString()}`}
                subtitle={run.notes || "Payroll run"}
                fields={[
                  { label: "Entries", value: run.entries.length.toString() },
                  { label: "Total Net", value: formatMoney(totalNet) },
                  { label: "Status", value: <StatusBadge status={run.status} /> },
                ]}
                actions={
                  canEdit ? (
                    <PayrollRunActions
                      run={{
                        id: run.id,
                        periodStart: run.periodStart.toISOString(),
                        periodEnd: run.periodEnd.toISOString(),
                        status: run.status,
                        notes: run.notes,
                        entries: run.entries.map((entry) => ({
                          employeeId: entry.employeeId,
                          baseSalary: Number(entry.baseSalary),
                          incentiveTotal: Number(entry.incentiveTotal),
                          deductions: Number(entry.deductions),
                          deductionReason: entry.deductionReason || "",
                        })),
                      }}
                      employees={employees}
                      canApprove={canApprove}
                    />
                  ) : null
                }
              />
            );
          })}
        </div>

        {runs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No payroll runs found.</div>
        )}

        {totalPages > 1 && (
          <div className="mt-4">
            <PaginationControls totalPages={totalPages} currentPage={page} />
          </div>
        )}
      </div>
    </div>
  );
}
