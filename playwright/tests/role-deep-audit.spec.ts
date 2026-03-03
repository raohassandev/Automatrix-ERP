import { test, request, devices, type BrowserContext, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loginAs } from "./helpers/auth";

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

type Finding = {
  severity: Severity;
  role: string;
  email: string;
  area: "ACCESS" | "RBAC" | "UI" | "UX" | "MOBILE" | "RUNTIME" | "LOGIC";
  route: string;
  issue: string;
  expected: string;
  actual: string;
};

type RoleProfile = {
  name: string;
  email: string;
  requiredRoutes: string[];
  restrictedRoutes: string[];
  requiredApis: string[];
  restrictedApis: string[];
};

const PASSWORD = process.env.E2E_TEST_PASSWORD || "e2e";
const REPORT_NAME = "STAGING_ROLE_DEEP_AUDIT_2026-03-03.md";

const ROLE_PROFILES: RoleProfile[] = [
  {
    name: "Finance Manager (QA)",
    email: "finance1@automatrix.pk",
    requiredRoutes: ["/dashboard", "/projects", "/expenses", "/approvals", "/settings", "/reports", "/accounting/journals", "/payroll"],
    restrictedRoutes: ["/ceo/dashboard", "/ceo/blueprint"],
    requiredApis: ["/api/employees", "/api/access-control/roles", "/api/accounting/journals", "/api/reports/accounting/trial-balance"],
    restrictedApis: [],
  },
  {
    name: "Engineering (QA)",
    email: "engineer1@automatrix.pk",
    requiredRoutes: ["/dashboard", "/me", "/projects", "/expenses"],
    restrictedRoutes: ["/approvals", "/reports", "/settings", "/accounting/journals", "/company-accounts", "/payroll", "/employees"],
    requiredApis: ["/api/projects", "/api/expenses"],
    restrictedApis: ["/api/access-control/roles", "/api/accounting/journals", "/api/reports/accounting/trial-balance", "/api/payroll/runs"],
  },
  {
    name: "Sales (QA)",
    email: "sales1@automatrix.pk",
    requiredRoutes: ["/dashboard", "/me", "/projects", "/expenses"],
    restrictedRoutes: ["/approvals", "/inventory", "/settings", "/accounting/journals", "/payroll", "/employees"],
    requiredApis: ["/api/projects", "/api/expenses"],
    restrictedApis: ["/api/access-control/roles", "/api/accounting/journals", "/api/reports/accounting/trial-balance", "/api/inventory"],
  },
  {
    name: "Store (QA)",
    email: "store1@automatrix.pk",
    requiredRoutes: ["/dashboard", "/me", "/projects", "/expenses", "/procurement/purchase-orders", "/procurement/grn", "/procurement/vendor-bills", "/inventory"],
    restrictedRoutes: ["/settings", "/reports", "/accounting/journals", "/company-accounts", "/payroll"],
    requiredApis: ["/api/projects", "/api/expenses", "/api/inventory", "/api/procurement/purchase-orders"],
    restrictedApis: ["/api/access-control/roles", "/api/accounting/journals", "/api/reports/accounting/trial-balance", "/api/payroll/runs"],
  },
  {
    name: "Technician (QA)",
    email: "technician1@automatrix.pk",
    requiredRoutes: ["/dashboard", "/me", "/projects", "/expenses"],
    restrictedRoutes: ["/inventory", "/procurement/purchase-orders", "/reports", "/settings", "/accounting/journals", "/company-accounts", "/payroll"],
    requiredApis: ["/api/projects", "/api/expenses"],
    restrictedApis: ["/api/access-control/roles", "/api/accounting/journals", "/api/reports/accounting/trial-balance", "/api/inventory", "/api/procurement/purchase-orders"],
  },
];

const CORE_ROUTES = [
  "/dashboard",
  "/me",
  "/projects",
  "/expenses",
  "/approvals",
  "/procurement/purchase-orders",
  "/inventory",
  "/reports",
  "/accounting/journals",
  "/payroll",
  "/settings",
];

function isForbiddenText(text: string) {
  return /do not have access|you do not have access|forbidden|access denied|unauthorized|not authorized/i.test(text);
}

function isFatalPageText(text: string) {
  return /internal server error|application error|something went wrong|failed to load|runtime error/i.test(text);
}

function stripAnsi(input: string) {
  return input.replace(/\u001B\[[0-9;]*m/g, "");
}

async function auditRoute(page: Page, route: string) {
  const localConsoleErrors: string[] = [];
  const onConsole = (msg: { type(): string; text(): string }) => {
    if (msg.type() === "error") {
      localConsoleErrors.push(msg.text());
    }
  };
  const onPageError = (err: Error) => {
    localConsoleErrors.push(`PAGEERROR:${err.message}`);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 8_000 });
  await page.waitForTimeout(150);
  const bodyText = await page.locator("body").innerText();
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  const severeErrors = localConsoleErrors.filter(
    (entry) =>
      !/favicon|Failed to load resource: the server responded with a status of 401|hydration/i.test(entry)
  );

  return {
    finalUrl: page.url(),
    bodyText,
    forbidden:
      isForbiddenText(bodyText) ||
      /error=forbidden/i.test(page.url()) ||
      /\/forbidden(?:\?|$)/i.test(page.url()),
    hasFatalText: isFatalPageText(bodyText),
    severeErrors,
    overflowX,
  };
}

async function readDesktopSidebarLinks(page: Page) {
  await page.waitForTimeout(500);
  return page.locator("aside a[href^='/']").evaluateAll((nodes) => {
    const hrefs = nodes
      .map((node) => (node as HTMLAnchorElement).getAttribute("href") || "")
      .filter((href) => href.startsWith("/"));
    return Array.from(new Set(hrefs));
  });
}

async function runDesktopAudit(
  context: BrowserContext,
  baseURL: string | undefined,
  profile: RoleProfile,
  findings: Finding[],
) {
  const page = await context.newPage();
  await loginAs(page, profile.email, PASSWORD);

  const routeCache = new Map<string, Awaited<ReturnType<typeof auditRoute>>>();
  const reportedRuntimeSignatures = new Set<string>();
  const getRouteResult = async (route: string) => {
    if (routeCache.has(route)) {
      return routeCache.get(route)!;
    }
    let result: Awaited<ReturnType<typeof auditRoute>>;
    try {
      result = await auditRoute(page, route);
    } catch (error) {
      result = {
        finalUrl: page.url(),
        bodyText: "",
        forbidden: false,
        hasFatalText: true,
        severeErrors: [`NAVIGATION_ERROR:${stripAnsi(error instanceof Error ? error.message : String(error)).slice(0, 320)}`],
        overflowX: false,
      };
    }
    routeCache.set(route, result);
    return result;
  };

  for (const route of CORE_ROUTES) {
    const result = await getRouteResult(route);
    if (result.hasFatalText) {
      findings.push({
        severity: "HIGH",
        role: profile.name,
        email: profile.email,
        area: "RUNTIME",
        route,
        issue: "Fatal error content rendered",
        expected: "No runtime/server error text on route",
        actual: result.bodyText.slice(0, 240),
      });
    }
    if (result.severeErrors.length > 0) {
      const signature = `${profile.email}:${result.severeErrors[0].slice(0, 180)}`;
      if (reportedRuntimeSignatures.has(signature)) {
        continue;
      }
      reportedRuntimeSignatures.add(signature);
      findings.push({
        severity: "MEDIUM",
        role: profile.name,
        email: profile.email,
        area: "RUNTIME",
        route,
        issue: "Console or page errors detected",
        expected: "No severe console/page error on route",
        actual: stripAnsi(result.severeErrors[0]).slice(0, 420),
      });
    }
    if (result.overflowX) {
      findings.push({
        severity: "MEDIUM",
        role: profile.name,
        email: profile.email,
        area: "UI",
        route,
        issue: "Horizontal overflow in desktop layout",
        expected: "No horizontal page overflow",
        actual: "document scrollWidth is wider than viewport",
      });
    }
  }

  for (const route of profile.requiredRoutes) {
    const result = await getRouteResult(route);
    if (result.forbidden) {
      findings.push({
        severity: "HIGH",
        role: profile.name,
        email: profile.email,
        area: "ACCESS",
        route,
        issue: "Required access is blocked",
        expected: "Role should access this route",
        actual: "Route displays forbidden/access-denied state",
      });
    }
  }

  for (const route of profile.restrictedRoutes) {
    const result = await getRouteResult(route);
    if (!result.forbidden) {
      findings.push({
        severity: "CRITICAL",
        role: profile.name,
        email: profile.email,
        area: "RBAC",
        route,
        issue: "Restricted route is accessible",
        expected: "Role should be blocked on this route",
        actual: `Route loaded without forbidden state (URL: ${result.finalUrl})`,
      });
    }
  }

  const sidebarLinks = await readDesktopSidebarLinks(page);
  for (const href of sidebarLinks) {
    const result = await getRouteResult(href);
    if (result.forbidden) {
      findings.push({
        severity: "HIGH",
        role: profile.name,
        email: profile.email,
        area: "UX",
        route: href,
        issue: "Sidebar exposes link to forbidden page",
        expected: "Forbidden features should be hidden from sidebar",
        actual: "Sidebar link visible, but route shows access denied",
      });
    }
  }

  if (profile.name === "Owner") {
    const settingsResult = await auditRoute(page, "/settings");
    if (!settingsResult.forbidden) {
      const roleTemplatesTab = page.getByRole("button", { name: "Role Templates" });
      if (await roleTemplatesTab.isVisible().catch(() => false)) {
        await roleTemplatesTab.click();
        const viewPermissionsBtn = page.getByRole("button", { name: "View Permissions" }).first();
        if (await viewPermissionsBtn.isVisible().catch(() => false)) {
          await viewPermissionsBtn.click();
          const dialogVisible = await page.getByRole("dialog").first().isVisible().catch(() => false);
          if (dialogVisible) {
            findings.push({
              severity: "MEDIUM",
              role: profile.name,
              email: profile.email,
              area: "UX",
              route: "/settings",
              issue: "Role permission editor is modal-only and cramped",
              expected: "Use full-page split layout (roles left, permissions right) for enterprise-scale editing",
              actual: "Permissions open in a modal dialog with limited workspace",
            });
          }
        }
      }
    }
  }

  const storageState = await context.storageState();
  const api = await request.newContext({
    baseURL,
    storageState,
    ignoreHTTPSErrors: true,
  });

  for (const endpoint of profile.requiredApis) {
    const res = await api.get(endpoint);
    if (res.status() >= 400) {
      findings.push({
        severity: "HIGH",
        role: profile.name,
        email: profile.email,
        area: "LOGIC",
        route: endpoint,
        issue: "Required API access denied",
        expected: "API should be available for this role",
        actual: `HTTP ${res.status()}`,
      });
    }
  }

  for (const endpoint of profile.restrictedApis) {
    const res = await api.get(endpoint);
    if (res.status() < 400) {
      findings.push({
        severity: "CRITICAL",
        role: profile.name,
        email: profile.email,
        area: "RBAC",
        route: endpoint,
        issue: "Restricted API endpoint is accessible",
        expected: "API should return 403/401 or equivalent denial",
        actual: `HTTP ${res.status()}`,
      });
    }
  }

  await api.dispose();
  await page.close();
}

async function runMobileAudit(
  baseURL: string | undefined,
  profile: RoleProfile,
  findings: Finding[],
  browser: import("@playwright/test").Browser,
) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    baseURL,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  await loginAs(page, profile.email, PASSWORD);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  const labeledMenuButton = page.getByRole("button", { name: /open navigation menu/i }).first();
  const fallbackMenuButton = page.locator("header button").first();
  const menuButton =
    (await labeledMenuButton.count()) > 0 ? labeledMenuButton : fallbackMenuButton;
  const menuVisible = await menuButton.isVisible().catch(() => false);
  if (!menuVisible) {
    findings.push({
      severity: "CRITICAL",
      role: profile.name,
      email: profile.email,
      area: "MOBILE",
      route: "/dashboard",
      issue: "No mobile navigation trigger found",
      expected: "Every mobile role should have a visible menu trigger",
      actual: "Header menu button not visible",
    });
    await context.close();
    return;
  }

  await menuButton.click();
  await page.waitForTimeout(350);
  const mobileLinks = await page.locator("[data-state='open'] a[href^='/']").evaluateAll((nodes) => {
    const hrefs = nodes
      .map((node) => (node as HTMLAnchorElement).getAttribute("href") || "")
      .filter((href) => href.startsWith("/"));
    return Array.from(new Set(hrefs));
  });

  if (mobileLinks.length === 0) {
    findings.push({
      severity: "HIGH",
      role: profile.name,
      email: profile.email,
      area: "MOBILE",
      route: "/dashboard",
      issue: "Mobile menu opens without actionable links",
      expected: "Mobile nav should list allowed modules",
      actual: "No route links detected in opened mobile menu",
    });
  }

  for (const link of mobileLinks.slice(0, 4)) {
    await page.goto(link, { waitUntil: "domcontentloaded", timeout: 8_000 });
    const bodyText = await page.locator("body").innerText();
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
    if (isForbiddenText(bodyText)) {
      findings.push({
        severity: "HIGH",
        role: profile.name,
        email: profile.email,
        area: "MOBILE",
        route: link,
        issue: "Mobile nav exposes forbidden page",
        expected: "Forbidden pages should be hidden from mobile navigation",
        actual: "Tapped mobile nav link and reached access-denied page",
      });
    }
    if (overflowX) {
      findings.push({
        severity: "MEDIUM",
        role: profile.name,
        email: profile.email,
        area: "MOBILE",
        route: link,
        issue: "Horizontal overflow on mobile route",
        expected: "Responsive layout without side scrolling",
        actual: "document scrollWidth wider than mobile viewport",
      });
    }
  }

  await context.close();
}

function findingsToMarkdown(findings: Finding[]) {
  const sorted = findings.sort((a, b) => {
    const order: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return order[a.severity] - order[b.severity];
  });

  const counts = sorted.reduce<Record<Severity, number>>(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  );

  const lines: string[] = [];
  lines.push("# Staging Deep Role Audit - Discrepancies Only");
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Scope: ${ROLE_PROFILES.map((r) => `${r.name} (${r.email})`).join("; ")}`);
  lines.push(`- Summary: CRITICAL ${counts.CRITICAL}, HIGH ${counts.HIGH}, MEDIUM ${counts.MEDIUM}, LOW ${counts.LOW}`);
  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (sorted.length === 0) {
    lines.push("- No discrepancies detected in this audit pass.");
    return lines.join("\n");
  }

  let index = 1;
  for (const finding of sorted) {
    lines.push(`### ${index}. [${finding.severity}] ${finding.issue}`);
    lines.push(`- Role: ${finding.role} (${finding.email})`);
    lines.push(`- Area: ${finding.area}`);
    lines.push(`- Route/API: ${finding.route}`);
    lines.push(`- Expected: ${finding.expected}`);
    lines.push(`- Actual: ${finding.actual}`);
    lines.push("");
    index += 1;
  }

  return lines.join("\n");
}

test.describe("Role Deep Audit (staging)", () => {
  test("collects discrepancy-only findings for all critical roles", async ({ browser, baseURL }) => {
    test.setTimeout(30 * 60 * 1000);
    const findings: Finding[] = [];

    for (const profile of ROLE_PROFILES) {
      try {
        const context = await browser.newContext({
          viewport: { width: 1512, height: 982 },
          baseURL,
          ignoreHTTPSErrors: true,
        });
        await runDesktopAudit(context, baseURL, profile, findings);
        await context.close();
      } catch (error) {
        findings.push({
          severity: "CRITICAL",
          role: profile.name,
          email: profile.email,
          area: "RUNTIME",
          route: "/login",
          issue: "Role audit execution failed",
          expected: "Audit should run end-to-end for this role",
          actual: stripAnsi(error instanceof Error ? error.message : String(error)).slice(0, 420),
        });
      }

      try {
        await runMobileAudit(baseURL, profile, findings, browser);
      } catch (error) {
        findings.push({
          severity: "HIGH",
          role: profile.name,
          email: profile.email,
          area: "MOBILE",
          route: "/dashboard",
          issue: "Mobile audit execution failed",
          expected: "Mobile navigation/layout checks should complete",
          actual: stripAnsi(error instanceof Error ? error.message : String(error)).slice(0, 420),
        });
      }
    }

    const markdown = findingsToMarkdown(findings);
    const reportDir = path.join(process.cwd(), "docs");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(path.join(reportDir, REPORT_NAME), markdown, "utf8");

    test.info().annotations.push({
      type: "audit-report",
      description: `Generated docs/${REPORT_NAME} with ${findings.length} findings`,
    });
  });
});
