"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
  DollarSign,
  TrendingUp,
  Users,
  FolderKanban,
  Package,
  FileText,
  LayoutDashboard,
  Bell,
  FileCheck,
  Paperclip,
} from "lucide-react";

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
          <CommandItem onSelect={() => runCommand(() => router.push("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/expenses"))}>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Expenses</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/income"))}>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Income</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/employees"))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Employees</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/projects"))}>
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Projects</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/inventory"))}>
            <Package className="mr-2 h-4 w-4" />
            <span>Inventory</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/invoices"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Invoices</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/approvals"))}>
            <FileCheck className="mr-2 h-4 w-4" />
            <span>Approvals</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/notifications"))}>
            <Bell className="mr-2 h-4 w-4" />
            <span>Notifications</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/attachments"))}>
            <Paperclip className="mr-2 h-4 w-4" />
            <span>Attachments</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/audit"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Audit Log</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/reports"))}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Reports</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          <CommandItem>
            <DollarSign className="mr-2 h-4 w-4" />
            <span>Submit Expense (⌘E)</span>
          </CommandItem>
          <CommandItem>
            <TrendingUp className="mr-2 h-4 w-4" />
            <span>Log Income (⌘I)</span>
          </CommandItem>
          <CommandItem>
            <Users className="mr-2 h-4 w-4" />
            <span>Add Employee (⌘⇧E)</span>
          </CommandItem>
          <CommandItem>
            <FolderKanban className="mr-2 h-4 w-4" />
            <span>Create Project (⌘⇧P)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
