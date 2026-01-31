import { test, expect } from "@playwright/test";

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  const header = page.locator("h1", { hasText: "Sign in" });
  await expect(header).toBeVisible();
  const googleButton = page.locator('button:has-text("Sign in with Google")');
  if (googleEnabled) {
    await expect(googleButton).toBeVisible();
  } else {
    await expect(googleButton).toHaveCount(0);
  }
  await expect(page.getByPlaceholder("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Password (min 8 chars)")).toBeVisible();
});
