import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';
import { EmployeesTable } from "@/components/EmployeesTable";
import SearchInput from "@/components/SearchInput";
import PaginationControls from "@/components/PaginationControls";

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
    walletBalance: number;
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
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { role: { contains: search, mode: "insensitive" } },
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
      walletBalance: parseFloat(emp.walletBalance.toString()),
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

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Employees</h1>
            <p className="mt-2 text-muted-foreground">Employee directory.</p>
          </div>
          <div className="min-w-[220px]">
            <SearchInput placeholder="Search employees..." />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <EmployeesTable employees={employees} />

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
