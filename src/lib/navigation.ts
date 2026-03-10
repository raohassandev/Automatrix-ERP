import {
  LayoutDashboard,
  CreditCard,
  Users,
  Wallet,
  FolderKanban,
  Building2,
  Package,
  FileText,
  Bell,
  FileCheck,
  FileBarChart,
  Settings,
  Receipt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  permissions?: string[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissions: ["dashboard.view"] },
      { name: "My Portal", href: "/me", icon: LayoutDashboard, permissions: ["employees.view_own", "employees.view_all"] },
      { name: "My Expenses", href: "/expenses", icon: CreditCard, permissions: ["expenses.view_own", "expenses.view_all"] },
      { name: "ERP Blueprint", href: "/ceo/blueprint", icon: FileBarChart, permissions: ["dashboard.view_all_metrics"] },
      { name: "CEO Dashboard", href: "/ceo/dashboard", icon: LayoutDashboard, permissions: ["dashboard.view_all_metrics"] },
      { name: "Notifications", href: "/notifications", icon: Bell, permissions: ["dashboard.view", "reports.view_all"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { name: "Projects", href: "/projects", icon: FolderKanban, permissions: ["projects.view_all", "projects.view_assigned"] },
      { name: "Tasks", href: "/tasks", icon: FileCheck, permissions: ["tasks.view_all", "tasks.view_assigned"] },
      { name: "Procurement", href: "/procurement/purchase-orders", icon: FileText, permissions: ["procurement.view_all", "procurement.edit"] },
      { name: "Inventory", href: "/inventory", icon: Package, permissions: ["inventory.view"] },
      { name: "Warehouses", href: "/inventory/warehouses", icon: Package, permissions: ["inventory.view"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { name: "Vendor Bills", href: "/procurement/vendor-bills", icon: Receipt, permissions: ["procurement.view_all", "procurement.edit"] },
      // Phase 1: Vendor Payments are finance/AP only (server-enforced).
      { name: "Vendor Payments", href: "/procurement/vendor-payments", icon: CreditCard, permissions: ["company_accounts.manage"] },
      { name: "Company Accounts", href: "/company-accounts", icon: CreditCard, permissions: ["company_accounts.manage"] },
      { name: "Chart of Accounts", href: "/accounting/accounts", icon: Receipt, permissions: ["accounting.view"] },
      { name: "Journals", href: "/accounting/journals", icon: FileText, permissions: ["accounting.view"] },
      { name: "Fiscal Periods", href: "/accounting/fiscal-periods", icon: Settings, permissions: ["accounting.manage"] },
      { name: "AP Aging", href: "/reports/ap", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
    ],
  },
  {
    title: "People",
    items: [
      { name: "Employees", href: "/employees", icon: Users, permissions: ["employees.view_all", "employees.view_team"] },
      { name: "Wallet Ledger", href: "/wallets", icon: Wallet, permissions: ["employees.view_own", "employees.view_all", "employees.edit_wallet"] },
      { name: "Payroll", href: "/payroll", icon: Wallet, permissions: ["payroll.view_all", "payroll.edit", "payroll.approve"] },
      { name: "Attendance", href: "/hrms/attendance", icon: Users, permissions: ["employees.view_all", "employees.view_team", "employees.view_own"] },
      { name: "Leave", href: "/hrms/leave", icon: Users, permissions: ["employees.view_all", "employees.view_team", "employees.view_own"] },
      { name: "Incentives", href: "/incentives", icon: Wallet, permissions: ["employees.view_own", "incentives.view_all"] },
      { name: "Salary Advances", href: "/salary-advances", icon: CreditCard, permissions: ["employees.view_own", "salary_advance.view_all"] },
    ],
  },
  {
    title: "Controls",
    items: [
      { name: "Approvals", href: "/approvals", icon: FileCheck, permissions: ["approvals.view_all", "approvals.view_pending", "approvals.approve_low", "approvals.approve_high", "expenses.approve_low", "expenses.approve_medium", "expenses.approve_high"] },
      { name: "Audit Log", href: "/audit", icon: FileText, permissions: ["audit.view"] },
      { name: "Master Data", href: "/master-data", icon: Building2, permissions: ["clients.view_all", "vendors.view_all", "categories.manage", "departments.view_all", "designations.view_all"] },
      { name: "Settings", href: "/settings", icon: Settings, permissions: ["employees.view_all", "company_accounts.manage", "accounting.manage"] },
    ],
  },
  {
    title: "Reports",
    items: [
      { name: "Reports Home", href: "/reports", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Trial Balance", href: "/reports/accounting/trial-balance", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "Cash Position", href: "/reports/accounting/cash-position", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "Cash Forecast", href: "/reports/accounting/cash-forecast", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "Bank Reconciliation", href: "/reports/accounting/bank-reconciliation", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "AR Aging", href: "/reports/accounting/ar-aging", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "O2C Reconciliation", href: "/reports/accounting/o2c-reconciliation", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "Profit & Loss", href: "/reports/accounting/profit-loss", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "Balance Sheet", href: "/reports/accounting/balance-sheet", icon: FileBarChart, permissions: ["accounting.view", "accounting.manage", "company_accounts.manage"] },
      { name: "Procurement Report", href: "/reports/procurement", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Inventory Report", href: "/reports/inventory", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Project Reports", href: "/reports/projects", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Exceptions Report", href: "/reports/exceptions", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
    ],
  },
  {
    title: "Directory",
    items: [
      { name: "Clients", href: "/clients", icon: Building2, permissions: ["clients.view_all"] },
      { name: "Vendors", href: "/vendors", icon: Building2, permissions: ["vendors.view_all"] },
    ],
  },
  // Legacy/out-of-scope pages remain accessible by URL if needed, but are hidden from the Phase 1 sidebar.
];
