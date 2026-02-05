'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, LogOut } from 'lucide-react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/me', label: 'My Dashboard' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/income', label: 'Income' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/incentives', label: 'Incentives' },
  { href: '/payroll', label: 'Payroll' },
  { href: '/salary-advances', label: 'Salary Advances' },
  { href: '/procurement/purchase-orders', label: 'Purchase Orders' },
  { href: '/procurement/grn', label: 'Goods Receipts' },
  { href: '/projects', label: 'Projects' },
  { href: '/employees', label: 'Employees' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/reports', label: 'Reports' },
  { href: '/reports/procurement', label: 'Procurement Report' },
  { href: '/attachments', label: 'Attachments' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/audit', label: 'Audit' },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

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
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    {item.label}
                  </Link>
                ))}
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
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="hover:text-gray-900">
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
