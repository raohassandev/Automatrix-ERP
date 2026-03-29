import { test, expect, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loginAs } from "./helpers/auth";

const PASSWORD = process.env.ROLE_OBJECTIVE_PASSWORD || "ChangeMe123!";
const REPORT_NAME = "EMPLOYEE_FINANCE_DEEP_AUDIT_PLAYWRIGHT_2026-03-29.md";
const WIDE_FROM = "2024-01-01T00:00:00.000Z";
const WIDE_TO = "2026-12-31T23:59:59.999Z";

const OWNER_EMAIL = "israrulhaq5@gmail.com";
const ACCOUNTANT_EMAIL = "raoabdulkhaliq786@gmail.com";
const EMPLOYEE_EMAIL = "raomazeem1122@gmail.com";
const PREFERRED_EMPLOYEE_EMAIL = "raoibrarulhaq1@gmail.com";

type OptionRow = {
  value: string;
  label: string;
};

type DeepAuditResult = {
  role: string;
  loginEmail: string;
  financeWorkspaceUrl?: string;
  analyticsUrl?: string;
  walletUrl?: string;
  chosenEmployee?: string;
  preferredEmployeeAvailable?: boolean;
  selectedCategory?: string;
  workspaceExpenseRows?: number;
  workspaceMonthlyRows?: number;
  categoryOptionCount?: number;
  analyticsEmployeeRows?: number;
  analyticsCategoryRows?: number;
  analyticsMonthlyRows?: number;
  analyticsDetailRows?: number;
  employeeBlocked?: boolean;
  notes: string[];
};

function hrefWithQuery(pathname: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

async function readSelectOptions(select: Locator): Promise<OptionRow[]> {
  return select.locator("option").evaluateAll((nodes) =>
    nodes.map((node) => ({
      value: (node as HTMLOptionElement).value,
      label: ((node.textContent || "").trim()),
    })),
  );
}

async function expectFinanceWorkspaceShell(page: Page) {
  await expect(page.getByRole("heading", { name: "Employee Finance Workspace" })).toBeVisible();
  await expect(page.getByText("Issued In Interval")).toBeVisible();
  await expect(page.getByText("Expense Approved")).toBeVisible();
  await expect(page.getByText("Advance Outstanding")).toBeVisible();
  await expect(page.getByText("Net Company Payable")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Category Breakdown" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monthly Expense & Funding Trend" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detailed Expense Rows" })).toBeVisible();
}

async function expectExpenseAnalyticsShell(page: Page) {
  await expect(page.getByRole("heading", { name: "Employee Expense Analytics" })).toBeVisible();
  await expect(page.getByText("Average Per Month")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Employee Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Category Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monthly Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detailed Rows" })).toBeVisible();
}

async function expectWalletShell(page: Page) {
  await expect(page.getByRole("heading", { name: "Wallet Ledger" })).toBeVisible();
  await expect(page.getByText("Credits")).toBeVisible();
  await expect(page.getByText("Debits")).toBeVisible();
  await expect(page.getByText("Net Movement")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source Summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Monthly Movement" })).toBeVisible();
}

async function getFirstExpenseEmployeeEmail(page: Page) {
  const table = page.locator("table").first();
  const rowCount = await table.locator("tbody tr").count();
  if (rowCount === 0) return null;
  const firstRow = table.locator("tbody tr").first();
  const email = ((await firstRow.locator("td").nth(1).textContent()) || "").trim();
  const name = ((await firstRow.locator("td").nth(0).textContent()) || "").trim();
  return {
    email,
    name,
    rowCount,
  };
}

async function openFinanceWorkspaceForEmployee(page: Page, employeeEmail: string) {
  await page.goto("/employees/finance-workspace", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expectFinanceWorkspaceShell(page);

  const employeeSelect = page.locator("select").first();
  const options = await readSelectOptions(employeeSelect);
  const matchingOption = options.find((option) => option.label.toLowerCase().includes(employeeEmail.toLowerCase()));
  if (!matchingOption) {
    throw new Error(`Employee ${employeeEmail} was not available in finance workspace options`);
  }

  const currentValue = await employeeSelect.inputValue();
  if (currentValue !== matchingOption.value) {
    await employeeSelect.selectOption(matchingOption.value);
    await page.waitForURL((url) => url.pathname === "/employees/finance-workspace" && url.searchParams.get("employeeId") === matchingOption.value, { timeout: 20_000 });
  }

  const financeUrl = hrefWithQuery("/employees/finance-workspace", {
    employeeId: matchingOption.value,
    from: WIDE_FROM,
    to: WIDE_TO,
  });
  await page.goto(financeUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expectFinanceWorkspaceShell(page);

  return {
    option: matchingOption,
    financeUrl,
  };
}

async function applyFirstCategoryIfAvailable(page: Page) {
  const categorySelect = page.locator("select").nth(2);
  const options = await readSelectOptions(categorySelect);
  const realOptions = options.filter((option) => option.value);

  if (realOptions.length === 0) {
    return {
      selectedCategory: null,
      categoryOptionCount: 0,
    };
  }

  const target = realOptions[0];
  await categorySelect.selectOption(target.value);
  await page.waitForURL((url) => url.pathname === "/employees/finance-workspace" && url.searchParams.get("category") === target.value, { timeout: 20_000 });
  await expectFinanceWorkspaceShell(page);

  return {
    selectedCategory: target.label,
    categoryOptionCount: realOptions.length,
  };
}

async function collectWorkspaceCounts(page: Page) {
  const expenseRows = await page.locator("#expense-detail tbody tr").count();
  const monthlyRows = await page.locator("#monthly-summary tbody tr").count();
  return {
    expenseRows,
    monthlyRows,
  };
}

function renderSection(title: string, result: DeepAuditResult) {
  const lines: string[] = [];
  lines.push(`## ${title}`);
  lines.push("");
  lines.push(`- Login: ${result.loginEmail}`);
  if (result.financeWorkspaceUrl) lines.push(`- Finance workspace: ${result.financeWorkspaceUrl}`);
  if (result.analyticsUrl) lines.push(`- Analytics: ${result.analyticsUrl}`);
  if (result.walletUrl) lines.push(`- Wallet drill: ${result.walletUrl}`);
  if (result.chosenEmployee) lines.push(`- Selected employee: ${result.chosenEmployee}`);
  if (typeof result.preferredEmployeeAvailable === "boolean") lines.push(`- Preferred employee available: ${result.preferredEmployeeAvailable ? "Yes" : "No"}`);
  if (typeof result.categoryOptionCount === "number") lines.push(`- Category filter options: ${result.categoryOptionCount}`);
  if (result.selectedCategory) lines.push(`- Category selected: ${result.selectedCategory}`);
  if (typeof result.workspaceExpenseRows === "number") lines.push(`- Workspace expense rows: ${result.workspaceExpenseRows}`);
  if (typeof result.workspaceMonthlyRows === "number") lines.push(`- Workspace monthly rows: ${result.workspaceMonthlyRows}`);
  if (typeof result.analyticsEmployeeRows === "number") lines.push(`- Analytics employee rows: ${result.analyticsEmployeeRows}`);
  if (typeof result.analyticsCategoryRows === "number") lines.push(`- Analytics category rows: ${result.analyticsCategoryRows}`);
  if (typeof result.analyticsMonthlyRows === "number") lines.push(`- Analytics monthly rows: ${result.analyticsMonthlyRows}`);
  if (typeof result.analyticsDetailRows === "number") lines.push(`- Analytics detail rows: ${result.analyticsDetailRows}`);
  if (typeof result.employeeBlocked === "boolean") lines.push(`- Cross-employee routes blocked: ${result.employeeBlocked ? "Yes" : "No"}`);
  lines.push("- Notes:");
  if (result.notes.length === 0) {
    lines.push("  - None");
  } else {
    for (const note of result.notes) {
      lines.push(`  - ${note}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

test.describe("Employee finance deep audit", () => {
  test("verifies the employee-finance workflow depth on staging", async ({ browser, baseURL }) => {
    test.setTimeout(25 * 60 * 1000);

    const ownerResult: DeepAuditResult = {
      role: "Owner",
      loginEmail: OWNER_EMAIL,
      notes: [],
    };

    const accountantResult: DeepAuditResult = {
      role: "Accountant",
      loginEmail: ACCOUNTANT_EMAIL,
      notes: [],
    };

    const employeeResult: DeepAuditResult = {
      role: "Employee",
      loginEmail: EMPLOYEE_EMAIL,
      notes: [],
    };

    const ownerContext = await browser.newContext({
      viewport: { width: 1512, height: 982 },
      baseURL,
      ignoreHTTPSErrors: true,
    });
    const ownerPage = await ownerContext.newPage();
    await loginAs(ownerPage, OWNER_EMAIL, PASSWORD);

    const analyticsUrl = hrefWithQuery("/reports/employee-expenses", { from: WIDE_FROM, to: WIDE_TO });
    await ownerPage.goto(analyticsUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expectExpenseAnalyticsShell(ownerPage);

    const analyticsFirstEmployee = await getFirstExpenseEmployeeEmail(ownerPage);
    expect(analyticsFirstEmployee).not.toBeNull();

    const preferredVisible = await ownerPage.locator("body").innerText().then((text) => text.toLowerCase().includes(PREFERRED_EMPLOYEE_EMAIL.toLowerCase()));
    ownerResult.preferredEmployeeAvailable = preferredVisible;

    const chosenEmployeeEmail = preferredVisible ? PREFERRED_EMPLOYEE_EMAIL : analyticsFirstEmployee!.email;
    const chosenEmployeeName = preferredVisible ? "Preferred employee" : analyticsFirstEmployee!.name;
    ownerResult.notes.push(
      preferredVisible
        ? `Used preferred employee ${PREFERRED_EMPLOYEE_EMAIL} for finance workflow verification.`
        : `Preferred employee ${PREFERRED_EMPLOYEE_EMAIL} had no visible analytics row in the active interval; used ${analyticsFirstEmployee!.email} (${analyticsFirstEmployee!.name}) to verify category/month/interval tooling with live data.`,
    );

    ownerResult.analyticsUrl = ownerPage.url();
    ownerResult.analyticsEmployeeRows = await ownerPage.locator("table").nth(0).locator("tbody tr").count();
    ownerResult.analyticsCategoryRows = await ownerPage.locator("table").nth(1).locator("tbody tr").count();
    ownerResult.analyticsMonthlyRows = await ownerPage.locator("table").nth(2).locator("tbody tr").count();
    ownerResult.analyticsDetailRows = await ownerPage.locator("table").nth(3).locator("tbody tr").count();
    ownerResult.notes.push("Owner can reach employee/category/month/detail analytics in one report destination.");

    const ownerWorkspace = await openFinanceWorkspaceForEmployee(ownerPage, chosenEmployeeEmail);
    ownerResult.financeWorkspaceUrl = ownerPage.url();
    ownerResult.chosenEmployee = `${ownerWorkspace.option.label}`;
    const categoryState = await applyFirstCategoryIfAvailable(ownerPage);
    ownerResult.selectedCategory = categoryState.selectedCategory || undefined;
    ownerResult.categoryOptionCount = categoryState.categoryOptionCount;
    const workspaceCounts = await collectWorkspaceCounts(ownerPage);
    ownerResult.workspaceExpenseRows = workspaceCounts.expenseRows;
    ownerResult.workspaceMonthlyRows = workspaceCounts.monthlyRows;
    ownerResult.notes.push("Issued amount, payables, reimbursements, and advances are visible on the workspace without leaving the page.");
    if (categoryState.selectedCategory) {
      ownerResult.notes.push(`Expense slice can be narrowed by category (${categoryState.selectedCategory}) from the workspace.`);
    } else {
      ownerResult.notes.push("No category options were available for the selected employee in the live interval; section shells still rendered.");
    }

    await ownerPage.getByRole("link", { name: "Wallet Credits" }).click();
    await ownerPage.waitForURL(/\/wallets/, { timeout: 20_000 });
    await expectWalletShell(ownerPage);
    ownerResult.walletUrl = ownerPage.url();
    ownerResult.notes.push("Exact wallet credit/debit evidence is one click from the workspace.");

    await ownerPage.goto(ownerWorkspace.financeUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expectFinanceWorkspaceShell(ownerPage);
    if (categoryState.selectedCategory) {
      const categorySelect = ownerPage.locator("select").nth(2);
      const categoryOptions = await readSelectOptions(categorySelect);
      const selectedOption = categoryOptions.find((option) => option.value && option.label === categoryState.selectedCategory);
      if (selectedOption) {
        await categorySelect.selectOption(selectedOption.value);
        await ownerPage.waitForURL((url) => url.pathname === "/employees/finance-workspace" && url.searchParams.get("category") === selectedOption.value, { timeout: 20_000 });
      }
    }
    await ownerPage.getByRole("link", { name: "Employee expense analytics" }).click();
    await ownerPage.waitForURL(/\/reports\/employee-expenses/, { timeout: 20_000 });
    await expectExpenseAnalyticsShell(ownerPage);
    ownerResult.notes.push("Category/month/average analysis remains one click away from the workspace via Employee expense analytics.");
    await ownerContext.close();

    const accountantContext = await browser.newContext({
      viewport: { width: 1512, height: 982 },
      baseURL,
      ignoreHTTPSErrors: true,
    });
    const accountantPage = await accountantContext.newPage();
    await loginAs(accountantPage, ACCOUNTANT_EMAIL, PASSWORD);
    const accountantWorkspace = await openFinanceWorkspaceForEmployee(accountantPage, chosenEmployeeEmail);
    accountantResult.financeWorkspaceUrl = accountantPage.url();
    accountantResult.chosenEmployee = accountantWorkspace.option.label;
    const accountantCategoryState = await applyFirstCategoryIfAvailable(accountantPage);
    accountantResult.selectedCategory = accountantCategoryState.selectedCategory || undefined;
    accountantResult.categoryOptionCount = accountantCategoryState.categoryOptionCount;
    const accountantWorkspaceCounts = await collectWorkspaceCounts(accountantPage);
    accountantResult.workspaceExpenseRows = accountantWorkspaceCounts.expenseRows;
    accountantResult.workspaceMonthlyRows = accountantWorkspaceCounts.monthlyRows;
    accountantResult.notes.push("Accountant can investigate issued amount, approved expense, and advance outstanding from the same workspace.");

    await accountantPage.getByRole("link", { name: "Employee expense analytics" }).click();
    await accountantPage.waitForURL(/\/reports\/employee-expenses/, { timeout: 20_000 });
    await expectExpenseAnalyticsShell(accountantPage);
    accountantResult.analyticsUrl = accountantPage.url();
    accountantResult.analyticsEmployeeRows = await accountantPage.locator("table").nth(0).locator("tbody tr").count();
    accountantResult.analyticsCategoryRows = await accountantPage.locator("table").nth(1).locator("tbody tr").count();
    accountantResult.analyticsMonthlyRows = await accountantPage.locator("table").nth(2).locator("tbody tr").count();
    accountantResult.analyticsDetailRows = await accountantPage.locator("table").nth(3).locator("tbody tr").count();
    accountantResult.notes.push("Accountant can reach category/month/detail analytics in one drill from the workspace.");
    await accountantContext.close();

    const employeeContext = await browser.newContext({
      viewport: { width: 1512, height: 982 },
      baseURL,
      ignoreHTTPSErrors: true,
    });
    const employeePage = await employeeContext.newPage();
    await loginAs(employeePage, EMPLOYEE_EMAIL, PASSWORD);
    await employeePage.goto("/me", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await expect(employeePage).not.toHaveURL(/\/login/);
    await employeePage.goto("/employees/finance-workspace", { waitUntil: "domcontentloaded", timeout: 45_000 });
    const employeeBody = ((await employeePage.locator("body").innerText()) || "").toLowerCase();
    employeeResult.employeeBlocked =
      employeePage.url().includes("/forbidden") ||
      employeeBody.includes("forbidden") ||
      employeeBody.includes("you do not have access");
    expect(employeeResult.employeeBlocked).toBeTruthy();
    employeeResult.notes.push("Employee self-scope login is correctly blocked from cross-employee finance investigation pages.");
    await employeeContext.close();

    const reportLines: string[] = [];
    reportLines.push("# Employee Finance Deep Audit");
    reportLines.push("");
    reportLines.push(`- Generated: ${new Date().toISOString()}`);
    reportLines.push(`- Base URL: ${baseURL || "unknown"}`);
    reportLines.push(`- Wide interval used: ${WIDE_FROM} to ${WIDE_TO}`);
    reportLines.push(`- Preferred employee example requested: ${PREFERRED_EMPLOYEE_EMAIL}`);
    reportLines.push("");
    reportLines.push("## Outcome");
    reportLines.push("");
    reportLines.push("- Owner and Accountant can answer issued amount, expense breakdown, monthly trend, averages, and exact expense rows using one primary finance workspace and one-click drills.");
    reportLines.push("- Wallet credits and debits are one click from the workspace, so issued amount evidence does not require a manual multi-page search.");
    reportLines.push("- Employee self-scope remains blocked from cross-employee finance investigation routes.");
    reportLines.push("");
    reportLines.push(renderSection("Owner", ownerResult));
    reportLines.push(renderSection("Accountant", accountantResult));
    reportLines.push(renderSection("Employee", employeeResult));

    const reportDir = path.join(process.cwd(), "docs");
    mkdirSync(reportDir, { recursive: true });
    writeFileSync(path.join(reportDir, REPORT_NAME), `${reportLines.join("\n")}\n`, "utf8");

    test.info().annotations.push({
      type: "audit-report",
      description: `Generated docs/${REPORT_NAME}`,
    });
  });
});
