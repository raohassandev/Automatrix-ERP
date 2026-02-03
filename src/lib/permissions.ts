export const PERMISSIONS = {
  CEO: ["*"],
  Owner: ["*"],
  "Finance Manager": [
    "dashboard.view",
    "dashboard.view_all_metrics",
    "clients.view_all",
    "clients.edit",
    "quotations.view_all",
    "expenses.view_all",
    "expenses.approve_high",
    "expenses.approve_medium",
    "expenses.approve_low",
    "expenses.reject",
    "expenses.edit",
    "income.view_all",
    "income.add",
    "income.edit",
    "income.approve_high",
    "income.approve_low",
    "approvals.view_all",
    "approvals.approve_high",
    "approvals.partial_approve",
    "inventory.view",
    "inventory.adjust",
    "inventory.approve_adjustment",
    "projects.view_all",
    "projects.edit",
    "projects.view_financials",
    "invoices.view_all",
    "invoices.create",
    "invoices.edit",
    "reports.view_all",
    "reports.export",
    "employees.view_all",
    "employees.edit_wallet",
  ],
  Manager: [
    "dashboard.view",
    "clients.view_all",
    "quotations.view_all",
    "expenses.view_all",
    "expenses.submit",
    "expenses.approve_low",
    "expenses.reject",
    "income.view_all",
    "income.add",
    "approvals.view_pending",
    "approvals.approve_low",
    "inventory.view",
    "inventory.request",
    "projects.view_all",
    "projects.view_assigned",
    "projects.update_status",
    "reports.view_team",
    "employees.view_team",
  ],
  Staff: [
    "dashboard.view",
    "expenses.view_own",
    "expenses.submit",
    "income.view_own",
    "inventory.view",
    "inventory.request",
    "projects.view_assigned",
    "reports.view_own",
    "employees.view_own",
  ],
  Guest: ["dashboard.view"],
} as const;

export type RoleName = keyof typeof PERMISSIONS;

export function hasPermission(role: RoleName, permission: string) {
  const list = PERMISSIONS[role] as readonly string[] | undefined;
  if (!list) return false;
  if (list.includes("*")) return true;
  
  // Defensive check: ensure permission is a string
  if (typeof permission !== 'string') {
    console.error('Permission must be a string, got:', typeof permission, permission);
    return false;
  }
  
  if (list.includes(permission)) return true;
  const permissionModule = permission.split(".")[0];
  return list.includes(`${permissionModule}.*`);
}
