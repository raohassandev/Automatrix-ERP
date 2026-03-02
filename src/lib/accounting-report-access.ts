import { requirePermission } from "@/lib/rbac";

export async function canAccessAccountingReports(userId: string) {
  const [canViewAccounting, canManageAccounting, canManageCompanyAccounts] = await Promise.all([
    requirePermission(userId, "accounting.view"),
    requirePermission(userId, "accounting.manage"),
    requirePermission(userId, "company_accounts.manage"),
  ]);

  return canViewAccounting || canManageAccounting || canManageCompanyAccounts;
}

