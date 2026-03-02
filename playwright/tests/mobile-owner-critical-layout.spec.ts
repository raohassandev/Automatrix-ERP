import { test, expect, devices } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";

test.describe("Mobile owner-critical layout", () => {
  test("core pages are mobile-friendly without horizontal overflow", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ ...devices["iPhone 13"], baseURL });
    const page = await context.newPage();

    await loginAs(page, FINANCE_EMAIL);

    const routes = ["/me", "/projects", "/projects/financial", "/incentives", "/commissions", "/payroll"];
    for (const route of routes) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(page.locator("main")).toBeVisible();
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
      expect(overflowX, `horizontal overflow on ${route}`).toBeFalsy();
    }

    const firstProjectLink = page.locator('main a[href^="/projects/"]').first();
    if ((await firstProjectLink.count()) > 0) {
      await firstProjectLink.click();
      await expect(page).toHaveURL(/\/projects\/[^/]+$/);

      const tabSelect = page.locator("select").first();
      await expect(tabSelect).toBeVisible();
      for (const label of ["Costs", "Inventory", "People", "Documents"]) {
        await tabSelect.selectOption({ label });
        await expect(page.locator("main")).toBeVisible();
        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
        expect(overflowX, `horizontal overflow on project detail tab ${label}`).toBeFalsy();
      }
    }

    await context.close();
  });
});
