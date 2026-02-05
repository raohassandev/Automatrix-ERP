"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { hasPermission, type RoleName } from "@/lib/permissions";
import { navGroups } from "@/lib/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp";
import { UserNav } from "./UserNav";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const roleName = ((session?.user as { role?: string })?.role || "Guest") as RoleName;
  const canAccess = (permissions?: string[]) =>
    !permissions || permissions.some((permission) => hasPermission(roleName, permission));
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("nav_collapsed");
    if (stored) {
      try {
        setCollapsed(JSON.parse(stored));
      } catch {
        setCollapsed({});
      }
    }
  }, []);

  const toggleGroup = (title: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      window.localStorage.setItem("nav_collapsed", JSON.stringify(next));
      return next;
    });
  };

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
          <nav className="flex-1 px-3 space-y-4">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter((item) => canAccess(item.permissions));
              if (visibleItems.length === 0) return null;
              return (
                <div key={group.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    className="flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    <span>{group.title}</span>
                    {collapsed[group.title] ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {!collapsed[group.title] &&
                    visibleItems.map((item) => {
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
                              isActive
                                ? "text-primary-foreground"
                                : "text-muted-foreground group-hover:text-accent-foreground"
                            )}
                          />
                          {item.name}
                        </Link>
                      );
                    })}
                </div>
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
