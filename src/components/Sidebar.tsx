"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { hasPermission, type RoleName } from "@/lib/permissions";
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
import ThemeToggle from "./ThemeToggle";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { UserNav } from "./UserNav";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permissions: ["dashboard.view"] },
  { name: "Expenses", href: "/expenses", icon: CreditCard, permissions: ["expenses.view_all", "expenses.view_own"] },
  { name: "By Project", href: "/expenses/by-project", icon: FolderKanban, permissions: ["expenses.view_all", "expenses.view_own"] },
  { name: "Income", href: "/income", icon: TrendingUp, permissions: ["income.view_all", "income.view_own"] },
  { name: "Clients", href: "/clients", icon: Building2, permissions: ["clients.view_all"] },
  { name: "Quotations", href: "/quotations", icon: FileSignature, permissions: ["quotations.view_all"] },
  { name: "Employees", href: "/employees", icon: Users, permissions: ["employees.view_all", "employees.view_team", "employees.view_own"] },
  { name: "Wallet Ledger", href: "/wallets", icon: Wallet, permissions: ["employees.view_all", "employees.view_own", "employees.edit_wallet"] },
  { name: "Projects", href: "/projects", icon: FolderKanban, permissions: ["projects.view_all", "projects.view_assigned"] },
  { name: "Project Financials", href: "/projects/financial", icon: FileBarChart, permissions: ["projects.view_financials", "reports.view_all"] },
  { name: "Inventory", href: "/inventory", icon: Package, permissions: ["inventory.view"] },
  { name: "Inventory Ledger", href: "/inventory/ledger", icon: FileBarChart, permissions: ["inventory.view"] },
  { name: "Invoices", href: "/invoices", icon: FileText, permissions: ["invoices.view_all"] },
  {
    name: "Approvals",
    href: "/approvals",
    icon: FileCheck,
    permissions: [
      "approvals.view_all",
      "approvals.view_pending",
      "approvals.approve_low",
      "approvals.approve_high",
      "expenses.approve_low",
      "expenses.approve_medium",
      "expenses.approve_high",
    ],
  },
  { name: "Notifications", href: "/notifications", icon: Bell, permissions: ["dashboard.view", "reports.view_all"] },
  { name: "Project Reports", href: "/reports/projects", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
  { name: "Reports", href: "/reports", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
  { name: "Categories", href: "/categories", icon: Tags, permissions: ["categories.manage"] },
  { name: "User Management", href: "/admin/users", icon: Shield, permissions: ["employees.view_all"] },
  { name: "Audit Log", href: "/audit", icon: FileText, permissions: ["reports.view_all"] },
  { name: "Settings", href: "/settings", icon: Settings, permissions: ["dashboard.view"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const roleName = ((session?.user as { role?: string })?.role || "Guest") as RoleName;
  const canAccess = (permissions?: string[]) =>
    !permissions || permissions.some((permission) => hasPermission(roleName, permission));

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r border-border">
      <div className="flex flex-col flex-1 min-h-0">
        {/* Logo and Controls */}
        <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 border-b border-border">
          <h1 className="text-lg font-bold text-foreground">AutoMatrix</h1>
          <div className="flex items-center gap-1">
            <KeyboardShortcutsHelp />
            <ThemeToggle />
            <UserNav />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-y-auto py-4">
          <nav className="flex-1 px-3 space-y-1">
            {navigation.filter((item) => canAccess(item.permissions)).map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon
                    className={cn(
                      "mr-3 h-5 w-5 flex-shrink-0",
                      isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-accent-foreground"
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border p-4">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">
                AutoMatrix ERP v1.0
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
