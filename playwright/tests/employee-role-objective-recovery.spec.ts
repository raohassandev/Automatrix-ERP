import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loginAs } from "./helpers/auth";

const PASSWORD = process.env.ROLE_OBJECTIVE_PASSWORD || "ChangeMe123!";
const REPORT_NAME = "ROLE_OBJECTIVE_RECOVERY_PLAYWRIGHT_2026-03-29.md";

const ACCOUNTS = [
  "israrulhaq5@gmail.com",
  "raoabdulkhaliq786@gmail.com",
  "raomazeem1122@gmail.com",
  "raoibrarulhaq1@gmail.com",
  "raomubasher5555@gmail.com",
];

type EffectivePermissionsResponse = {
  role?: string;
  permissions?: string[];
  deniedPermissions?: string[];
};

type RouteAudit = {
  route: string;
  label: string;
  finalUrl: string;
  bodySample: string;
  outcome: "allowed" | "forbidden" | "linkage_issue" | "runtime_error";
  directNavVisible: boolean;
};

type AccountAudit = {
  email: string;
  detectedRole: string;
  permissions: string[];
  objectivesPassed: string[];
  objectivesFailed: string[];
  routes: RouteAudit[];
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function classifyRouteOutcome(text: string, finalUrl: string): RouteAudit["outcome"] {
  const haystack = `${text} ${finalUrl}`.toLowerCase();
  if (/employee not found|no accessible employee record|no accessible employee record was linked/.test(haystack)) {
    return "linkage_issue";
  }
  if (/forbidden|access denied|do not have access|unauthorized/.test(haystack)) {
    return "forbidden";
  }
  if (/internal server error|application error|something went wrong|runtime error/.test(haystack)) {
    return "runtime_error";
  }
  return "allowed";
}

async function auditRoute(
  page: import("@playwright/test").Page,
  route: string,
  label: string,
  directNavMatcher?: RegExp,
): Promise<RouteAudit> {
  const directNavVisible = directNavMatcher
    ? await page.locator(`aside a[href="${route}"], [data-state='open'] a[href="${route}"]`).first().isVisible().catch(() => false)
    : false;

  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(400);
  const bodyText = normalizeText(await page.locator("body").innerText());
  const finalUrl = page.url();

  return {
    route,
    label,
    finalUrl,
    bodySample: bodyText.slice(0, 280),
    outcome: classifyRouteOutcome(bodyText, finalUrl),
    directNavVisible,
  };
}

function summarizeAccount(audit: AccountAudit) {
  const lines: string[] = [];
  lines.push(`## ${audit.email}`);
  lines.push("");
  lines.push(`- Detected role: ${audit.detectedRole}`);
  lines.push(`- Objective pass count: ${audit.objectivesPassed.length}`);
  lines.push(`- Objective fail count: ${audit.objectivesFailed.length}`);
  lines.push(`- Objectives passed: ${audit.objectivesPassed.join(", ") || "None"}`);
  lines.push(`- Objectives failed: ${audit.objectivesFailed.join(", ") || "None"}`);
  lines.push(`- Effective permissions sample: ${(audit.permissions || []).slice(0, 12).join(", ") || "None"}`);
  lines.push("");
  lines.push("| Objective | Route | Outcome | Direct Nav | Final URL | Notes |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const route of audit.routes) {
    lines.push(
      `| ${route.label} | ${route.route} | ${route.outcome} | ${route.directNavVisible ? "Yes" : "No"} | ${route.finalUrl} | ${route.bodySample.replace(/\|/g, "/")} |`
    );
  }
  lines.push("");
  return lines.join("\n");
}

test.describe("Employee role-objective recovery audit", () => {
  test("audits supplied staging accounts for employee-domain objectives", async ({ browser, baseURL }) => {
    test.setTimeout(20 * 60 * 1000);

    const accountAudits: AccountAudit[] = [];

    for (const email of ACCOUNTS) {
      const context = await browser.newContext({
        viewport: { width: 1512, height: 982 },
        baseURL,
        ignoreHTTPSErrors: true,
      });
      const page = await context.newPage();

      await loginAs(page, email, PASSWORD);
      await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 45_000 });
      await expect(page).not.toHaveURL(/\/login/);

      const effectiveRes = await page.request.get("/api/me/effective-permissions");
      const effective = (await effectiveRes.json().catch(() => ({}))) as EffectivePermissionsResponse;
      const permissions = Array.isArray(effective.permissions) ? effective.permissions : [];
      const detectedRole = String(effective.role || "Unknown");

      const routes: RouteAudit[] = [];
      routes.push(await auditRoute(page, "/me", "Self Service"));
      routes.push(await auditRoute(page, "/employees", "Employee Directory"));
      routes.push(await auditRoute(page, "/employees/finance-workspace", "Finance Workspace"));
      routes.push(await auditRoute(page, "/reports/employee-expenses", "Employee Expense Report"));

      const objectivesPassed: string[] = [];
      const objectivesFailed: string[] = [];

      const meRoute = routes.find((route) => route.route === "/me")!;
      if (meRoute.outcome === "allowed") objectivesPassed.push("Self-service portal works");
      else objectivesFailed.push("Self-service portal blocked/broken");

      const financeRoute = routes.find((route) => route.route === "/employees/finance-workspace")!;
      if (financeRoute.outcome === "allowed") objectivesPassed.push("Employee finance workspace works");
      else if (financeRoute.outcome === "linkage_issue") objectivesFailed.push("Finance workspace blocked by user-employee linkage");
      else objectivesFailed.push("Employee finance workspace blocked");

      const expenseRoute = routes.find((route) => route.route === "/reports/employee-expenses")!;
      if (expenseRoute.outcome === "allowed") objectivesPassed.push("Employee expense report works");
      else objectivesFailed.push("Employee expense report blocked");

      accountAudits.push({
        email,
        detectedRole,
        permissions,
        objectivesPassed,
        objectivesFailed,
        routes,
      });

      await context.close();
    }

    const lines: string[] = [];
    lines.push("# Role-Objective Recovery Playwright Audit");
    lines.push("");
    lines.push(`- Generated: ${new Date().toISOString()}`);
    lines.push(`- Base URL: ${baseURL || "unknown"}`);
    lines.push(`- Accounts audited: ${ACCOUNTS.join(", ")}`);
    lines.push(`- Shared password used: ${PASSWORD ? "Yes" : "No"}`);
    lines.push("");
    lines.push("## Summary");
    lines.push("");

    for (const audit of accountAudits) {
      lines.push(
        `- ${audit.email}: role=${audit.detectedRole}, passed=${audit.objectivesPassed.length}, failed=${audit.objectivesFailed.length}`
      );
    }

    lines.push("");
    lines.push("## Details");
    lines.push("");
    for (const audit of accountAudits) {
      lines.push(summarizeAccount(audit));
    }

    const reportDir = path.join(process.cwd(), "docs");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(path.join(reportDir, REPORT_NAME), `${lines.join("\n")}\n`, "utf8");

    test.info().annotations.push({
      type: "audit-report",
      description: `Generated docs/${REPORT_NAME}`,
    });
  });
});
