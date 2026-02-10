import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import PaginationControls from "@/components/PaginationControls";
import { PayrollRunCreateButton } from "@/components/PayrollRunCreateButton";
import { PayrollRunActions } from "@/components/PayrollRunActions";

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
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Payroll</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to payroll.</p>
      </div>
    );
  }

  const params = searchParams;
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 20;
  const skip = (page - 1) * take;

  const [runs, total, employees] = await Promise.all([
    prisma.payrollRun.findMany({
      orderBy: { periodStart: "desc" },
      include: { entries: true },
      skip,
      take,
    }),
    prisma.payrollRun.count(),
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

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
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
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
                    <td className="py-2">{run.status}</td>
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
