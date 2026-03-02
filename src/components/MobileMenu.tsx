'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { type RoleName } from '@/lib/permissions';
import { navGroups } from '@/lib/navigation';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const roleName = ((session?.user as { role?: string })?.role || 'Guest') as RoleName;
  const { canAccess } = useEffectivePermissions(roleName);
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.permissions)),
    }))
    .filter((group) => group.items.length > 0);
  const showFallbackQuickLinks = Boolean(session?.user) && visibleGroups.length === 0;

  return (
    <>
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
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
              <div className="flex-1 grid gap-4">
                {visibleGroups.map((group) => {
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
                            className="text-sm font-medium text-gray-600 hover:text-gray-900"
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
                        className="text-sm font-medium text-gray-600 hover:text-gray-900"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/me"
                        onClick={() => setOpen(false)}
                        className="text-sm font-medium text-gray-600 hover:text-gray-900"
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
      <nav className="hidden md:flex md:flex-wrap md:gap-4 md:text-sm md:text-gray-600">
        {navGroups
          .flatMap((group) => group.items)
          .filter((item) => canAccess(item.permissions))
          .map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-gray-900">
              {item.name}
            </Link>
          ))}
      </nav>
    </>
  );
}
