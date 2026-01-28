import { test, expect } from "@playwright/test";

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  const header = page.locator("h1", { hasText: "Sign in" });
  await expect(header).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in with Google" })).toBeVisible();
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password (min 8 chars)")).toBeVisible();
});
