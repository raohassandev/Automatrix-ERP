import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { formatMoney } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

export default async function WalletReportPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/login");
  }

  const canViewAll = await requirePermission(session.user.id, "reports.view_all");
  const canViewTeam = await requirePermission(session.user.id, "reports.view_team");
  const canViewOwn = await requirePermission(session.user.id, "reports.view_own");
  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Wallet Summary</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to reports.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const baseWhere: import("@prisma/client").Prisma.EmployeeWhereInput =
    !canViewAll && !canViewTeam
      ? { email: session.user.email || "__none__" }
      : {};

  const where: import("@prisma/client").Prisma.EmployeeWhereInput = search
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { role: { contains: search, mode: "insensitive" as const } },
            ],
          },
        ],
      }
    : baseWhere;

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({ where, orderBy: { name: "asc" }, skip, take }),
    prisma.employee.count({ where }),
  ]);

  const totals = employees.reduce(
    (acc, emp) => {
      const balance = Number(emp.walletBalance);
      const hold = Number(emp.walletHold || 0);
      acc.total += balance;
      acc.totalHold += hold;
      return acc;
    },
    { total: 0, totalHold: 0 }
  );

  const totalPages = Math.max(1, Math.ceil(total / take));

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Employee Wallet Summary</h1>
            <p className="mt-2 text-muted-foreground">Wallet balances and holds.</p>
          </div>
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search employees..." />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Wallet Balance</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.total)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Total Holds</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.totalHold)}</div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="text-sm text-muted-foreground">Available</div>
          <div className="mt-2 text-xl font-semibold">{formatMoney(totals.total - totals.totalHold)}</div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Employee</th>
                <th className="py-2">Role</th>
                <th className="py-2">Balance</th>
                <th className="py-2">Hold</th>
                <th className="py-2">Available</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const balance = Number(emp.walletBalance);
                const hold = Number(emp.walletHold || 0);
                const available = balance - hold;
                const isNegative = available < 0;
                const isLow = available >= 0 && available < 1000;
                return (
                  <tr key={emp.id} className={`border-b ${isNegative ? "bg-red-50/60" : ""}`}>
                    <td className="py-2">{emp.name}</td>
                    <td className="py-2">{emp.role}</td>
                    <td className="py-2">{formatMoney(balance)}</td>
                    <td className="py-2">{formatMoney(hold)}</td>
                    <td className="py-2">
                      <span
                        className={`font-medium ${
                          isNegative ? "text-red-700" : isLow ? "text-amber-700" : "text-foreground"
                        }`}
                      >
                        {formatMoney(available)}
                      </span>
                      {isLow ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Low
                        </span>
                      ) : null}
                      {isNegative ? (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Overdrawn
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {employees.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">No employees found.</div>
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
