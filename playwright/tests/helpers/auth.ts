import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password = process.env.E2E_TEST_PASSWORD || "e2e") {
  await page.goto("/login", { waitUntil: "networkidle" });

  const emailInput = page.getByPlaceholder("Email").first();
  const passwordInput = page.getByPlaceholder("Password").first();
  await emailInput.click();
  await emailInput.press("Control+a");
  await emailInput.type(email, { delay: 10 });
  await passwordInput.click();
  await passwordInput.press("Control+a");
  await passwordInput.type(password, { delay: 10 });

  const localE2eButton = page.getByRole("button", { name: "E2E Sign in" }).first();
  const credentialsButton = page.getByRole("button", { name: "Sign in with Email" }).first();
  if (await localE2eButton.isVisible().catch(() => false)) {
    await localE2eButton.click();
  } else {
    await expect(credentialsButton).toBeEnabled();
    await credentialsButton.click();
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });
}
