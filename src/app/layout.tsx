import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import './globals.css';
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar } from "@/components/Sidebar";
import { RouteLoadingIndicator } from "@/components/RouteLoadingIndicator";
import MobileMenu from "@/components/MobileMenu";

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
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="min-h-screen bg-background text-foreground">
            <RouteLoadingIndicator />
            {/* Sidebar - Desktop only */}
            <Sidebar />

            {/* Main content - with left margin on desktop for sidebar */}
            <div className="md:pl-64">
              <header className="sticky top-0 z-40 border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
                <div className="flex items-center justify-between">
                  <div className="text-base font-semibold">AutoMatrix ERP</div>
                  <MobileMenu />
                </div>
              </header>
              <main className="px-4 py-6 md:px-6 md:py-8">{children}</main>
            </div>

            <FloatingActionButton />
            <CommandPalette />
            <Toaster />
            </div>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
