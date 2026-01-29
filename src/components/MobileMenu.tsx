'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
import Link from 'next/link';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/income', label: 'Income' },
  { href: '/approvals', label: 'Approvals' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/projects', label: 'Projects' },
  { href: '/employees', label: 'Employees' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/reports', label: 'Reports' },
  { href: '/attachments', label: 'Attachments' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/audit', label: 'Audit' },
];

export default function MobileMenu() {
  const [open, setOpen] = useState(false);

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
            <div className="grid gap-4 py-4">
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
