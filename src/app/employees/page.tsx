import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/format";
import EmployeeForm from "@/components/EmployeeForm";
import { DeleteButton, QuickEditButton } from "@/components/TableActions";
import { requirePermission } from "@/lib/rbac";
import { redirect } from 'next/navigation';

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
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-2 text-gray-600">You do not have access to employees.</p>
      </div>
    );
  }

  const where = canViewAll || canViewTeam
    ? {}
    : { email: session.user.email || "__none__" };

  const employees = await prisma.employee.findMany({ where, orderBy: { name: "asc" } });

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-2 text-gray-600">Employee directory.</p>
      </div>

      <EmployeeForm />

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Wallet</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b">
                  <td className="py-2">{employee.name}</td>
                  <td className="py-2">{employee.email}</td>
                  <td className="py-2">{employee.role}</td>
                  <td className="py-2">{formatMoney(Number(employee.walletBalance))}</td>
                  <td className="py-2">{employee.status}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <QuickEditButton
                        url={`/api/employees/${employee.id}`}
                        fields={{ role: "Role", status: "Status", phone: "Phone" }}
                      />
                      <DeleteButton url={`/api/employees/${employee.id}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
