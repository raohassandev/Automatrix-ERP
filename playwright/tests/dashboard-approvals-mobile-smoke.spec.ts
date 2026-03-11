import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";

test.describe("Dashboard + Approvals mobile smoke", () => {
  test("finance user sees KPI cards on dashboard", async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Income (This Month)")).toBeVisible();
    await expect(page.getByText("Expense (This Month)")).toBeVisible();
    await expect(page.getByText("Net Position")).toBeVisible();
    await expect(page.getByText("Pending Queue", { exact: true })).toBeVisible();
  });

  test("approvals actions remain visible and clickable on mobile width", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await loginAs(page, FINANCE_EMAIL);
    await page.goto("/approvals", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Pending Approvals" })).toBeVisible();
    const hasEmptyState = await page.getByText("No pending approvals at the moment").first().isVisible().catch(() => false);
    if (!hasEmptyState) {
      const actionButton = page.getByRole("button", { name: /Approve|Reject/i }).first();
      await expect(actionButton).toBeVisible();
    }

    await context.close();
  });
});
