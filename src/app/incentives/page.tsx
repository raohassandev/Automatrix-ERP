import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { IncentiveCreateButton } from "@/components/IncentiveCreateButton";
import { IncentiveActions } from "@/components/IncentiveActions";
import { MobileCard } from "@/components/MobileCard";
import { employeeCodeFromId } from "@/lib/employee-display";
import Link from "next/link";

export default async function IncentivesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "incentives.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canEdit = await requirePermission(session.user.id, "incentives.edit");
  const canApprove = await requirePermission(session.user.id, "incentives.approve");
  if (!canViewAll && !canViewOwn && !canEdit) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-semibold">Incentives</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to incentives.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  let ownEmployeeId: string | null = null;
  if (!canViewAll && session.user.email) {
    const employee = await prisma.employee.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    ownEmployeeId = employee?.id || null;
  }

  const where: Record<string, unknown> = {};
  if (!canViewAll) {
    where.employeeId = ownEmployeeId || "__none__";
  }
  if (search) {
    where.OR = [
      { projectRef: { contains: search, mode: "insensitive" as const } },
      { employee: { name: { contains: search, mode: "insensitive" as const } } },
      { employee: { email: { contains: search, mode: "insensitive" as const } } },
    ];
  }

  const [rows, total, employees] = await Promise.all([
    prisma.incentiveEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: true },
      skip,
      take,
    }),
    prisma.incentiveEntry.count({ where }),
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Incentives</h1>
            <p className="mt-2 text-muted-foreground">Track project incentives and deductions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee or project..." />
            </div>
            <Link
              href="/help#feature-incentives"
              className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              Help
            </Link>
            {canEdit ? <IncentiveCreateButton employees={employees} /> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <details className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-primary">
            Help: Incentive Flow
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>Create incentive against completed project with amount or formula basis.</li>
            <li>Approve incentive after commercial confirmation.</li>
            <li>`PAYROLL` payout remains unsettled until payroll settlement marks it paid.</li>
            <li>`WALLET` payout settles on approval through wallet credit flow.</li>
            <li>Use employee and project filters to verify due and settled variable pay.</li>
          </ol>
        </details>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Project</th>
                <th className="py-2">Payout</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Settlement</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    {row.employee ? (
                      <Link href={`/employees/${row.employeeId}`} className="font-medium text-primary underline underline-offset-2">
                        {employeeCodeFromId(row.employeeId)} - {row.employee.name}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-2">{row.projectRef || "-"}</td>
                  <td className="py-2">{row.payoutMode || "-"}</td>
                  <td className="py-2">{formatMoney(Number(row.amount))}</td>
                  <td className="py-2">{row.settlementStatus || "-"}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <IncentiveActions
                        incentive={{
                          id: row.id,
                          employeeId: row.employeeId,
                          projectRef: row.projectRef,
                          formulaType: row.formulaType,
                          basisAmount: row.basisAmount ? Number(row.basisAmount) : null,
                          percent: row.percent ? Number(row.percent) : null,
                          payoutMode: row.payoutMode,
                          amount: Number(row.amount),
                          reason: row.reason,
                          status: row.status,
                        }}
                        employees={employees}
                        canApprove={canApprove}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <MobileCard
              key={row.id}
              title={`${employeeCodeFromId(row.employeeId)} - ${row.employee?.name || "Employee"}`}
              subtitle={new Date(row.createdAt).toLocaleDateString()}
              fields={[
                { label: "Project", value: row.projectRef || "-" },
                { label: "Payout", value: row.payoutMode || "-" },
                { label: "Amount", value: formatMoney(Number(row.amount)) },
                { label: "Settlement", value: row.settlementStatus || "-" },
                { label: "Status", value: row.status },
              ]}
              actions={
                canEdit ? (
                  <IncentiveActions
                    incentive={{
                      id: row.id,
                      employeeId: row.employeeId,
                      projectRef: row.projectRef,
                      formulaType: row.formulaType,
                      basisAmount: row.basisAmount ? Number(row.basisAmount) : null,
                      percent: row.percent ? Number(row.percent) : null,
                      payoutMode: row.payoutMode,
                      amount: Number(row.amount),
                      reason: row.reason,
                      status: row.status,
                    }}
                    employees={employees}
                    canApprove={canApprove}
                  />
                ) : null
              }
            />
          ))}
        </div>

        {rows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No incentives found.</div>
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
