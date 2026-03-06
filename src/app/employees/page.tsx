import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';
import { EmployeesTable } from "@/components/EmployeesTable";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";
import { PageCreateButton } from "@/components/PageCreateButton";
import { formatMoney } from "@/lib/format";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return (
       redirect("/login")
       );
  }

  const canViewAll = await requirePermission(session.user.id, "employees.view_all");
  const canViewTeam = await requirePermission(session.user.id, "employees.view_team");
  const canViewOwn = await requirePermission(session.user.id, "employees.view_own");
  const canCreate = await requirePermission(session.user.id, "employees.view_all");

  if (!canViewAll && !canViewTeam && !canViewOwn) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-2 text-muted-foreground">You do not have access to employees.</p>
      </div>
    );
  }

  const params = await searchParams;
  const search = (params.search || "").trim();
  const page = Math.max(parseInt(params.page || "1", 10), 1);
  const take = 25;
  const skip = (page - 1) * take;

  const baseWhere = canViewAll || canViewTeam
    ? {}
    : { email: session.user.email || "__none__" };

  let employees: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    phone?: string | null;
    department?: string | null;
    designation?: string | null;
    cnic?: string | null;
    address?: string | null;
    education?: string | null;
    experience?: string | null;
    reportingOfficerId?: string | null;
    joinDate?: string | null;
    walletBalance: number;
    walletHold: number;
  }> = [];
  let totalPages = 1;
  let hasError = false;

  try {
    const where = search
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { role: { contains: search, mode: "insensitive" as const } },
                { department: { contains: search, mode: "insensitive" as const } },
                { designation: { contains: search, mode: "insensitive" as const } },
              ],
            },
          ],
        }
      : baseWhere;

    const [employeesRaw, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
      }),
      prisma.employee.count({ where }),
    ]);
    totalPages = Math.max(1, Math.ceil(total / take));

    // Convert Decimal to number for component compatibility
    employees = employeesRaw.map((emp) => ({
      ...emp,
      joinDate: emp.joinDate ? emp.joinDate.toISOString().slice(0, 10) : null,
      walletBalance: parseFloat(emp.walletBalance.toString()),
      walletHold: parseFloat(emp.walletHold.toString()),
    }));
  } catch (error) {
    console.error("Error fetching employees:", error);
    hasError = true;
  }

  if (hasError) {
    return (
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-2 text-muted-foreground">Error loading employee data. Please try again later.</p>
      </div>
    );
  }

  const summary = employees.reduce(
    (acc, employee) => {
      if (employee.status === "ACTIVE") acc.active += 1;
      else acc.inactive += 1;
      acc.wallet += Number(employee.walletBalance || 0);
      acc.hold += Number(employee.walletHold || 0);
      return acc;
    },
    { active: 0, inactive: 0, wallet: 0, hold: 0 },
  );

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Employees</h1>
            <p className="mt-2 text-muted-foreground">Employee directory.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-[220px]">
              <SearchInput placeholder="Search employees..." />
            </div>
            {canCreate ? (
              <PageCreateButton label="Add Employee" formType="employee" />
            ) : null}
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="text-sm text-emerald-700">Active</div>
            <div className="text-xl font-semibold text-emerald-800">{summary.active}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-sm text-slate-700">Inactive</div>
            <div className="text-xl font-semibold text-slate-800">{summary.inactive}</div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
            <div className="text-sm text-sky-700">Wallet Balance</div>
            <div className="text-xl font-semibold text-sky-800">{formatMoney(summary.wallet)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <div className="text-sm text-amber-700">Wallet Hold</div>
            <div className="text-xl font-semibold text-amber-800">{formatMoney(summary.hold)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
      <EmployeesTable employees={employees} canEditEmployees={canViewAll} />

        {employees.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center text-muted-foreground">
            <div>No employees found.</div>
            {canCreate ? <PageCreateButton label="Add Employee" formType="employee" /> : null}
          </div>
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
