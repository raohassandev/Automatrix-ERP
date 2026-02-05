import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { hasPermission, type RoleName } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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

async function logApiRequest(request: NextRequest, userId: string) {
  if (
    request.method === "POST" ||
    request.method === "PUT" ||
    request.method === "DELETE"
  ) {
    await logAudit({
      action: `API_${request.method}`,
      entity: "API_REQUEST",
      entityId: request.nextUrl.pathname,
      userId,
    });
  }
}

export async function proxy(request: NextRequest) {
  const url = new URL(request.url);
  const { pathname } = url;

  // Public routes - add security headers and allow through
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login") || pathname.startsWith("/api/register")) {
    const response = NextResponse.next();
    addSecurityHeaders(response);
    return response;
  }

  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/api/")) {
    await logApiRequest(request, session.user.id as string);
  }

  const roleName = ((session.user as { role?: string }).role || "Guest") as RoleName;
  const rule = ROUTE_RULES.find((entry) => entry.pattern.test(pathname));
  if (rule && !rule.any.some((perm) => hasPermission(roleName, perm))) {
    const fallbackUrl = new URL("/dashboard", request.url);
    fallbackUrl.searchParams.set("error", "forbidden");
    return NextResponse.redirect(fallbackUrl);
  }

  // Authenticated routes - add security headers
  const response = NextResponse.next();
  addSecurityHeaders(response);
  return response;
}


/**
 * Add security headers to all responses
 * Implements OWASP security best practices
 */
function addSecurityHeaders(response: NextResponse) {
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection for older browsers
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Restrict browser features
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Next.js dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; ')
  );
  
  return response;
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
    "/ceo/:path*",
  ],
};
