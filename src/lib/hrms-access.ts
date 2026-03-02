import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";

export async function resolveHrmsScope(userId: string, userEmail?: string | null) {
  const canViewAll = await requirePermission(userId, "employees.view_all");
  const canViewTeam = await requirePermission(userId, "employees.view_team");
  const canViewOwn = await requirePermission(userId, "employees.view_own");
  const canManage = canViewAll || (await requirePermission(userId, "payroll.edit"));
  const canApprove = canViewAll || (await requirePermission(userId, "payroll.approve"));

  if (canViewAll || canViewTeam) {
    return {
      canManage,
      canApprove,
      employeeId: null as string | null,
    };
  }

  if (canViewOwn && userEmail) {
    const employee = await prisma.employee.findUnique({
      where: { email: userEmail },
      select: { id: true },
    });
    return {
      canManage: false,
      canApprove: false,
      employeeId: employee?.id || null,
    };
  }

  return {
    canManage: false,
    canApprove: false,
    employeeId: null as string | null,
  };
}
