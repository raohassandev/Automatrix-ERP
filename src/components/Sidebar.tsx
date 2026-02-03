"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Expenses", href: "/expenses", icon: CreditCard },
  { name: "By Project", href: "/expenses/by-project", icon: FolderKanban },
  { name: "Income", href: "/income", icon: TrendingUp },
  { name: "Clients", href: "/clients", icon: Building2 },
  { name: "Quotations", href: "/quotations", icon: FileSignature },
  { name: "Employees", href: "/employees", icon: Users },
  { name: "Wallet Ledger", href: "/wallets", icon: Wallet },
  { name: "Projects", href: "/projects", icon: FolderKanban },
  { name: "Project Financials", href: "/projects/financial", icon: FileBarChart },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Inventory Ledger", href: "/inventory/ledger", icon: FileBarChart },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Approvals", href: "/approvals", icon: FileCheck },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Project Reports", href: "/reports/projects", icon: FileBarChart },
  { name: "Reports", href: "/reports", icon: FileBarChart },
  { name: "Categories", href: "/categories", icon: Tags },
  { name: "User Management", href: "/admin/users", icon: Shield },
  { name: "Audit Log", href: "/audit", icon: FileText },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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
            {navigation.map((item) => {
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
