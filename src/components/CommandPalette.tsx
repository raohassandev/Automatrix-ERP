"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  CreditCard,
  Settings,
  DollarSign,
  TrendingUp,
  Users,
  FolderKanban,
  Building2,
  FileSignature,
  Wallet,
  Package,
  FileBarChart,
  FileText,
  LayoutDashboard,
  Bell,
  FileCheck,
  Paperclip,
  Tags,
} from "lucide-react";
import { type RoleName } from "@/lib/permissions";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const roleName = ((session?.user as { role?: string })?.role || "Guest") as RoleName;
  const { canAccess } = useEffectivePermissions(roleName);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Pages">
          {[
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissions: ["dashboard.view"] },
            { href: "/expenses", label: "Expenses", icon: CreditCard, permissions: ["expenses.view_all", "expenses.view_own"] },
            { href: "/income", label: "Income", icon: TrendingUp, permissions: ["income.view_all", "income.view_own"] },
            { href: "/employees", label: "Employees", icon: Users, permissions: ["employees.view_all", "employees.view_team", "employees.view_own"] },
            { href: "/hrms/attendance", label: "Attendance", icon: Users, permissions: ["employees.view_all", "employees.view_team", "employees.view_own"] },
            { href: "/hrms/leave", label: "Leave", icon: Users, permissions: ["employees.view_all", "employees.view_team", "employees.view_own"] },
            { href: "/departments", label: "Departments", icon: Tags, permissions: ["departments.view_all"] },
            { href: "/designations", label: "Designations", icon: Tags, permissions: ["designations.view_all"] },
            { href: "/wallets", label: "Wallet Ledger", icon: Wallet, permissions: ["employees.view_all", "employees.view_own", "employees.edit_wallet"] },
            { href: "/clients", label: "Clients", icon: Building2, permissions: ["clients.view_all"] },
            { href: "/quotations", label: "Quotations", icon: FileSignature, permissions: ["quotations.view_all"] },
            { href: "/projects", label: "Projects", icon: FolderKanban, permissions: ["projects.view_all", "projects.view_assigned"] },
            { href: "/inventory", label: "Inventory", icon: Package, permissions: ["inventory.view"] },
            { href: "/inventory/ledger", label: "Inventory Ledger", icon: FileBarChart, permissions: ["inventory.view"] },
            { href: "/invoices", label: "Invoices", icon: FileText, permissions: ["invoices.view_all"] },
            { href: "/vendors", label: "Vendors", icon: Building2, permissions: ["vendors.view_all"] },
            { href: "/commissions", label: "Commissions", icon: FileBarChart, permissions: ["commissions.view_all"] },
            {
              href: "/approvals",
              label: "Approvals",
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
            { href: "/notifications", label: "Notifications", icon: Bell, permissions: ["dashboard.view", "reports.view_all"] },
            { href: "/attachments", label: "Attachments", icon: Paperclip, permissions: ["reports.view_all"] },
            { href: "/audit", label: "Audit Log", icon: FileText, permissions: ["reports.view_all"] },
            { href: "/settings", label: "Settings", icon: Settings, permissions: ["employees.view_all", "accounting.manage", "company_accounts.manage"] },
            { href: "/reports", label: "Reports", icon: FileText, permissions: ["reports.view_all", "reports.view_team", "reports.view_own"] },
            { href: "/reports/accounting/bank-reconciliation", label: "Bank Reconciliation", icon: FileBarChart, permissions: ["reports.view_all", "reports.view_team", "reports.view_own", "company_accounts.view"] },
            { href: "/categories", label: "Categories", icon: Tags, permissions: ["categories.manage"] },
          ]
            .filter((item) => canAccess(item.permissions))
            .map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.href} onSelect={() => runCommand(() => router.push(item.href))}>
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {[
            { label: "Submit Expense (⌘E)", icon: DollarSign, permissions: ["expenses.submit"] },
            { label: "Log Income (⌘I)", icon: TrendingUp, permissions: ["income.add"] },
            { label: "Add Employee (⌘⇧E)", icon: Users, permissions: ["employees.view_all"] },
            { label: "Create Project (⌘⇧P)", icon: FolderKanban, permissions: ["projects.edit"] },
          ]
            .filter((item) => canAccess(item.permissions))
            .map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem key={item.label}>
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{item.label}</span>
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
