import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  Users,
  FolderKanban,
  Building2,
  Package,
  FileText,
  Bell,
  FileCheck,
  FileBarChart,
  FileSignature,
  Wallet,
  Settings,
  Tags,
  Shield,
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
      { name: "My Dashboard", href: "/me", icon: LayoutDashboard, permissions: ["employees.view_own", "employees.view_all"] },
      { name: "ERP Blueprint", href: "/ceo/blueprint", icon: FileBarChart, permissions: ["executive.view"] },
      { name: "Notifications", href: "/notifications", icon: Bell, permissions: ["dashboard.view", "reports.view_all"] },
    ],
  },
  {
    title: "HR & Admin",
    items: [
      { name: "Employees", href: "/employees", icon: Users, permissions: ["employees.view_all", "employees.view_team", "employees.view_own"] },
      { name: "Salary Advances", href: "/salary-advances", icon: FileBarChart, permissions: ["salary_advance.view_all", "employees.view_own"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { name: "Expenses", href: "/expenses", icon: CreditCard, permissions: ["expenses.view_all", "expenses.view_own"] },
      { name: "Income", href: "/income", icon: TrendingUp, permissions: ["income.view_all", "income.view_own"] },
      { name: "Approvals", href: "/approvals", icon: FileCheck, permissions: ["approvals.view_all", "approvals.view_pending", "approvals.approve_low", "approvals.approve_high", "expenses.approve_low", "expenses.approve_medium", "expenses.approve_high"] },
      { name: "Payroll", href: "/payroll", icon: FileBarChart, permissions: ["payroll.view_all"] },
      { name: "Incentives", href: "/incentives", icon: FileBarChart, permissions: ["incentives.view_all", "employees.view_own"] },
      { name: "Wallet Ledger", href: "/wallets", icon: Wallet, permissions: ["employees.view_all", "employees.view_own", "employees.edit_wallet"] },
    ],
  },
  {
    title: "Projects",
    items: [
      { name: "Projects", href: "/projects", icon: FolderKanban, permissions: ["projects.view_all", "projects.view_assigned"] },
      { name: "Project Financials", href: "/projects/financial", icon: FileBarChart, permissions: ["projects.view_financials", "reports.view_all"] },
      { name: "Project Expenses", href: "/expenses/by-project", icon: FolderKanban, permissions: ["expenses.view_all", "expenses.view_own"] },
    ],
  },
  {
    title: "Procurement",
    items: [
      { name: "Purchase Orders", href: "/procurement/purchase-orders", icon: FileText, permissions: ["procurement.view_all", "procurement.edit"] },
      { name: "Goods Receipts", href: "/procurement/grn", icon: FileCheck, permissions: ["procurement.view_all", "procurement.edit"] },
    ],
  },
  {
    title: "Inventory",
    items: [
      { name: "Inventory", href: "/inventory", icon: Package, permissions: ["inventory.view"] },
      { name: "Inventory Ledger", href: "/inventory/ledger", icon: FileBarChart, permissions: ["inventory.view"] },
    ],
  },
  {
    title: "CRM & Sales",
    items: [
      { name: "Clients", href: "/clients", icon: Building2, permissions: ["clients.view_all"] },
      { name: "Quotations", href: "/quotations", icon: FileSignature, permissions: ["quotations.view_all"] },
      { name: "Invoices", href: "/invoices", icon: FileText, permissions: ["invoices.view_all"] },
    ],
  },
  {
    title: "Reports",
    items: [
      { name: "Reports Home", href: "/reports", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Project Reports", href: "/reports/projects", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Procurement Report", href: "/reports/procurement", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Inventory Report", href: "/reports/inventory", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Wallet Report", href: "/reports/wallets", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Expense Report", href: "/reports/expenses", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
      { name: "Employee Expenses", href: "/reports/employee-expenses", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
    ],
  },
  {
    title: "Settings",
    items: [
      { name: "Categories", href: "/categories", icon: Tags, permissions: ["categories.manage"] },
      { name: "User Management", href: "/admin/users", icon: Shield, permissions: ["employees.view_all"] },
      { name: "Audit Log", href: "/audit", icon: FileText, permissions: ["reports.view_all"] },
      { name: "Settings", href: "/settings", icon: Settings, permissions: ["dashboard.view"] },
    ],
  },
];
