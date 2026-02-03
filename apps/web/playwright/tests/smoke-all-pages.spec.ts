import { test, expect } from "@playwright/test";

/**
 * Authenticated smoke test: visit all sidebar pages and fail on obvious runtime errors.
 *
 * Run:
 *   pnpm -C apps/web test:e2e -- smoke-all-pages
 */

test.describe("Smoke: authenticated user can load all pages", () => {
  const routes = [
    "/dashboard",
    "/expenses",
    "/expenses/by-project",
    "/income",
    "/employees",
    "/projects",
    "/projects/financial",
    "/inventory",
    "/invoices",
    "/approvals",
    "/notifications",
    "/reports/projects",
    "/reports",
    "/categories",
    "/admin/users",
    "/audit",
    "/settings",
  ];

  test.beforeEach(async ({ page }) => {
    // Login via dev-bypass credentials (see src/lib/auth.ts)
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("admin@automatrix.local");
    await page.getByPlaceholder(/Password/i).fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Ensure we land somewhere authenticated.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  for (const route of routes) {
    test(`loads ${route}`, async ({ page }) => {
      const resp = await page.goto(route, { waitUntil: "domcontentloaded" });

      // If navigation is blocked by auth, we will see /login. That is a failure for this test.
      await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 });

      // HTTP layer sanity: avoid silent 500/404.
      // Note: Next.js may respond 200 with an error page; we also check content below.
      expect(resp?.status(), `Unexpected HTTP status for ${route}`).toBeGreaterThanOrEqual(200);
      expect(resp?.status(), `Unexpected HTTP status for ${route}`).toBeLessThan(400);

      // Fail on Next.js error boundary pages / overlays.
      // (Heuristics – keeps test low-maintenance)
      await expect(page.locator("text=Application error")).toHaveCount(0);
      await expect(page.locator("text=Unhandled Runtime Error")).toHaveCount(0);
      await expect(page.locator("text=Error: ")).toHaveCount(0);

      // Basic page has some content.
      await expect(page.locator("body")).not.toBeEmpty();
    });
  }
});
