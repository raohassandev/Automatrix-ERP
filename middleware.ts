import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, type RoleName } from "@/lib/permissions";

const ROUTE_RULES: Array<{ pattern: RegExp; any: string[] }> = [
  { pattern: /^\/dashboard/, any: ["dashboard.view"] },
  { pattern: /^\/expenses/, any: ["expenses.view_all", "expenses.view_own"] },
  { pattern: /^\/income/, any: ["income.view_all", "income.view_own"] },
  {
    pattern: /^\/approvals/,
    any: ["approvals.view_all", "approvals.view_pending", "approvals.approve_low", "approvals.approve_high"],
  },
  { pattern: /^\/inventory/, any: ["inventory.view"] },
  { pattern: /^\/projects/, any: ["projects.view_all", "projects.view_assigned"] },
  {
    pattern: /^\/employees/,
    any: ["employees.view_all", "employees.view_team", "employees.view_own"],
  },
  { pattern: /^\/invoices/, any: ["invoices.view_all"] },
  { pattern: /^\/reports/, any: ["reports.view_all", "reports.view_team", "reports.view_own"] },
  { pattern: /^\/settings/, any: ["settings.view"] },
];

export async function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const { pathname } = url;

  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const roleName = ((session.user as { role?: string }).role || "Guest") as RoleName;
  const rule = ROUTE_RULES.find((entry) => entry.pattern.test(pathname));
  if (rule && !rule.any.some((perm) => hasPermission(roleName, perm))) {
    const fallbackUrl = new URL("/dashboard", request.url);
    fallbackUrl.searchParams.set("error", "forbidden");
    return NextResponse.redirect(fallbackUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/expenses/:path*",
    "/income/:path*",
    "/approvals/:path*",
    "/inventory/:path*",
    "/projects/:path*",
    "/employees/:path*",
    "/invoices/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
