import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import './globals.css';


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AutoMatrix ERP",
  description: "Enterprise ERP built with Next.js",
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/expenses", label: "Expenses" },
  { href: "/income", label: "Income" },
  { href: "/approvals", label: "Approvals" },
  { href: "/inventory", label: "Inventory" },
  { href: "/projects", label: "Projects" },
  { href: "/employees", label: "Employees" },
  { href: "/invoices", label: "Invoices" },
  { href: "/reports", label: "Reports" },
  { href: "/attachments", label: "Attachments" },
  { href: "/notifications", label: "Notifications" },
  { href: "/audit", label: "Audit" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-gray-50 text-gray-900">
          <header className="border-b bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div className="text-lg font-semibold">AutoMatrix ERP</div>
              <nav className="flex flex-wrap gap-4 text-sm text-gray-600">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="hover:text-gray-900">
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
