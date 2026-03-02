import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password = process.env.E2E_TEST_PASSWORD || "e2e") {
  await page.goto("/login", { waitUntil: "networkidle" });

  const credentialsPanel = page.locator("div").filter({ hasText: "Email login (staging/internal)" }).first();
  const emailInput = credentialsPanel.getByPlaceholder("Email").first();
  const passwordInput = credentialsPanel.getByPlaceholder("Password").first();
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await emailInput.fill(email);
  await passwordInput.fill(password);

  const localE2eButton = page.getByRole("button", { name: "E2E Sign in" }).first();
  const credentialsButton = credentialsPanel.getByRole("button", { name: "Sign in with Email" }).first();
  if (await localE2eButton.isVisible().catch(() => false)) {
    await localE2eButton.click();
  } else {
    await expect(credentialsPanel).toBeVisible();
    await expect(credentialsButton).toBeEnabled();
    await credentialsButton.click();
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}
