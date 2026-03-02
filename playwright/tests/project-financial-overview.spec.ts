import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";

test.describe("Project financial UX coverage", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL);
  });

  test("projects overview and detail show owner-friendly financial summary", async ({ page }) => {
    await page.goto("/projects", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.getByText(/cash to recover/i)).toBeVisible();

    const firstProjectLink = page.locator('main table tbody tr').first().locator('a[href^="/projects/"]').first();
    await expect(firstProjectLink).toBeVisible();
    await firstProjectLink.click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/);

    await expect(page.getByText("Money In (Approved)", { exact: true })).toBeVisible();
    await expect(page.getByText("Money Out (Cost to Date)", { exact: true })).toBeVisible();
    await expect(page.getByText("Current Profit", { exact: true })).toBeVisible();
    await expect(page.getByText("Cash to Recover", { exact: true })).toBeVisible();
    await expect(page.getByText("Unpaid Vendor Bills", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Costs" }).click();
    await expect(page.getByRole("heading", { name: "Finance Summary" })).toBeVisible();
    await expect(page.getByText("Revenue & Recovery", { exact: true })).toBeVisible();
    await expect(page.getByText("Payables & Costs", { exact: true })).toBeVisible();
    await expect(page.getByText("Profitability View", { exact: true })).toBeVisible();
  });

  test("project financial dashboard uses live metrics layout without overflow", async ({ page }) => {
    await page.goto("/projects/financial", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Project Financial Dashboard" })).toBeVisible();
    await expect(page.getByText(/money in/i)).toBeVisible();
    await expect(page.getByText(/current profit/i)).toBeVisible();
    await expect(page.getByText(/cash risk projects/i)).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 8,
    );
    expect(hasOverflow).toBeFalsy();
  });
});
