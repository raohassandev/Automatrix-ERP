import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import './globals.css';
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import MobileMenu from "@/components/MobileMenu";
import ThemeToggle from "@/components/ThemeToggle";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen bg-gray-50 text-gray-900">
            <header className="border-b bg-white">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                <div className="text-lg font-semibold">AutoMatrix ERP</div>
                <div className="flex items-center gap-4">
                  <MobileMenu />
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
            <Toaster />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
