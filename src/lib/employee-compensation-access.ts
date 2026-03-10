import { getUserRoleName, requirePermission } from "@/lib/rbac";

const COMPENSATION_MANAGER_ROLES = new Set([
  "HR",
  "Admin",
  "Owner",
  "CEO",
  "CFO",
  "Finance Manager",
  "Accountant",
]);

export async function canManageEmployeeCompensation(userId: string) {
  const [canEditPayroll, roleName] = await Promise.all([
    requirePermission(userId, "payroll.edit"),
    getUserRoleName(userId),
  ]);

  if (canEditPayroll) return true;
  return COMPENSATION_MANAGER_ROLES.has(String(roleName || ""));
}
