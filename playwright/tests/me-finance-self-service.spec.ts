import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const EMPLOYEE_EMAIL = process.env.ME_FINANCE_TEST_EMAIL || "raomazeem1122@gmail.com";
const PASSWORD =
  process.env.ME_FINANCE_TEST_PASSWORD ||
  process.env.ROLE_OBJECTIVE_PASSWORD ||
  process.env.E2E_TEST_PASSWORD ||
  "ChangeMe123!";

test.describe("My finance self-service", () => {
  test("shows finance summary, notices, and one-click drills for employee", async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const visitedPathnames = new Set<string>();
    const rememberPath = () => {
      try {
        visitedPathnames.add(new URL(page.url()).pathname);
      } catch {
        // Ignore non-URL states during startup.
      }
    };

    await loginAs(page, EMPLOYEE_EMAIL, PASSWORD);
    await page.goto("/me", { waitUntil: "domcontentloaded", timeout: 45_000 });
    rememberPath();

    await expect(page.getByRole("heading", { name: "My Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "My Finance Summary" })).toBeVisible();
    await expect(page.getByText("Available Wallet").first()).toBeVisible();
    await expect(page.getByText("Reimburse Due").first()).toBeVisible();
    await expect(page.getByText("Advance Outstanding").first()).toBeVisible();
    await expect(page.getByText("Payroll Pending").first()).toBeVisible();
    await expect(page.getByText("Variable Pay Pending").first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Finance Notices" })).toBeVisible();
    await expect(page.getByText("My Reimbursements").first()).toBeVisible();
    await expect(page.getByText("My Advances").first()).toBeVisible();
    await expect(page.getByText("My Payroll").first()).toBeVisible();
    await expect(page.getByText("My Variable Pay").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Variable Pay History" })).toBeVisible();

    const reimburseLink = page.getByRole("link", { name: "Due Claims", exact: true }).first();
    await expect(reimburseLink).toHaveAttribute("href", /paymentSource=EMPLOYEE_POCKET/);
    await expect(reimburseLink).toHaveAttribute("href", /status=APPROVED/);
    await reimburseLink.click();
    await page.waitForURL(/\/expenses\?/, { timeout: 20_000 });
    rememberPath();
    await expect(page).toHaveURL(/paymentSource=EMPLOYEE_POCKET/);
    await expect(page).toHaveURL(/status=APPROVED/);
    await page.goto("/me", { waitUntil: "domcontentloaded", timeout: 45_000 });
    rememberPath();
    await expect(page.getByRole("heading", { name: "My Dashboard" })).toBeVisible();

    const advanceLink = page.getByRole("link", { name: "Advance History", exact: true }).first();
    await expect(advanceLink).toHaveAttribute("href", /\/salary-advances\?employeeId=/);

    const payrollLink = page.getByRole("link", { name: "Payroll History", exact: true }).first();
    await expect(payrollLink).toHaveAttribute("href", "/payroll");

    const variablePayCard = page.getByText("My Variable Pay").first().locator("..");

    const incentivesLink = variablePayCard.getByRole("link", { name: "Incentives", exact: true }).first();
    await expect(incentivesLink).toHaveAttribute("href", /\/incentives\?employeeId=/);

    const commissionsLink = variablePayCard.getByRole("link", { name: "Commissions", exact: true }).first();
    await expect(commissionsLink).toHaveAttribute("href", /\/commissions\?search=/);

    expect(visitedPathnames.size).toBeLessThanOrEqual(2);
  });
});
