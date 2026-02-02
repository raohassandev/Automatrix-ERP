import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';
import { EmployeesTable } from "@/components/EmployeesTable";

export default async function EmployeesPage() {
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

  const where = canViewAll || canViewTeam
    ? {}
    : { email: session.user.email || "__none__" };

  let employees = [];
  try {
    const employeesRaw = await prisma.employee.findMany({ where, orderBy: { name: "asc" } });
    
    // Convert Decimal to number for component compatibility
    employees = employeesRaw.map((emp) => ({
      ...emp,
      walletBalance: parseFloat(emp.walletBalance.toString()),
    }));
  } catch (error) {
    console.error("Error fetching employees:", error);
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
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-2 text-muted-foreground">Employee directory.</p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <EmployeesTable employees={employees} />
      </div>
    </div>
  );
}
