'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut, Search } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { type RoleName } from '@/lib/permissions';
import { navGroups } from '@/lib/navigation';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { usePathname } from 'next/navigation';

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: session } = useSession();
  const pathname = usePathname();
  const roleName = ((session?.user as { role?: string })?.role || 'Guest') as RoleName;
  const { canAccess } = useEffectivePermissions(roleName);
  const filtered = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (!canAccess(item.permissions)) return false;
        if (!query.trim()) return true;
        return item.name.toLowerCase().includes(query.trim().toLowerCase());
      }),
    }))
    .filter((group) => group.items.length > 0);
  const allVisibleItems = filtered.flatMap((g) => g.items);
  const quickLinks = allVisibleItems.filter((item) =>
    ["/dashboard", "/me", "/projects", "/expenses", "/inventory"].includes(item.href),
  );
  const showFallbackQuickLinks = Boolean(session?.user) && filtered.length === 0;

  return (
    <>
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open navigation menu">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <div className="flex flex-col h-full">
              {/* User Info */}
              {session?.user && (
                <div className="pb-4 mb-4 border-b">
                  <p className="text-sm font-medium">{session.user.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{session.user.email}</p>
                </div>
              )}
              
              {/* Navigation Links */}
              <div className="flex-1 grid gap-4 overflow-y-auto pr-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search menu..."
                    className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm"
                  />
                </div>

                {quickLinks.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Access</div>
                    <div className="grid grid-cols-2 gap-2">
                      {quickLinks.slice(0, 4).map((item) => (
                        <Link
                          key={`quick-${item.href}`}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`rounded-md border px-3 py-2 text-sm font-medium ${
                            pathname === item.href ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
                          }`}
                        >
                          {item.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}

                {filtered.map((group) => {
                  return (
                    <div key={group.title} className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.title}
                      </div>
                      <div className="grid gap-2">
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`rounded-md px-2 py-2 text-sm font-medium ${
                              pathname === item.href
                                ? "bg-primary/10 text-primary"
                                : "text-foreground/80 hover:bg-accent hover:text-foreground"
                            }`}
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {showFallbackQuickLinks ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Quick Access
                    </div>
                    <div className="grid gap-2">
                      <Link
                        href="/dashboard"
                        onClick={() => setOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/me"
                        onClick={() => setOpen(false)}
                        className="text-sm font-medium text-muted-foreground hover:text-foreground"
                      >
                        My Portal
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Logout Button */}
              {session?.user && (
                <div className="pt-4 mt-4 border-t">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => {
                      setOpen(false);
                      signOut({ callbackUrl: '/login' });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <nav className="hidden md:flex md:flex-wrap md:gap-4 md:text-sm md:text-muted-foreground">
        {navGroups
          .flatMap((group) => group.items)
          .filter((item) => canAccess(item.permissions))
          .map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.name}
            </Link>
          ))}
      </nav>
    </>
  );
}
