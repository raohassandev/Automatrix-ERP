import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { CommissionCreateButton } from "@/components/CommissionCreateButton";
import { CommissionActions } from "@/components/CommissionActions";

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "commissions.view_all");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canEdit = await requirePermission(session.user.id, "commissions.edit");
  const canApprove = await requirePermission(session.user.id, "commissions.approve");
  if (!canViewAll && !canViewOwn && !canEdit) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Commissions</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to commissions.</p>
      </div>
    );
  }

  const params = searchParams;
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
    prisma.commissionEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: true },
      skip,
      take,
    }),
    prisma.commissionEntry.count({ where }),
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Commissions</h1>
            <p className="mt-2 text-muted-foreground">Track sales commissions and adjustments.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employee or project..." />
            </div>
            {canEdit ? <CommissionCreateButton employees={employees} /> : null}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Date</th>
                <th className="py-2">Employee</th>
                <th className="py-2">Project</th>
                <th className="py-2">Basis</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="py-2">{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{row.employee?.name || row.employee?.email || "-"}</td>
                  <td className="py-2">{row.projectRef || "-"}</td>
                  <td className="py-2">
                    {row.basisType ? `${row.basisType}` : "-"}
                    {row.percent ? ` • ${Number(row.percent)}%` : ""}
                  </td>
                  <td className="py-2">{formatMoney(Number(row.amount))}</td>
                  <td className="py-2">{row.status}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <CommissionActions
                        commission={{
                          id: row.id,
                          employeeId: row.employeeId,
                          projectRef: row.projectRef,
                          basisType: row.basisType,
                          basisAmount: row.basisAmount ? Number(row.basisAmount) : null,
                          percent: row.percent ? Number(row.percent) : null,
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

        {rows.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No commissions found.</div>
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
