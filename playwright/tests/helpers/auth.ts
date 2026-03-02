import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password = process.env.E2E_TEST_PASSWORD || "e2e") {
  await page.goto("/login", { waitUntil: "networkidle", timeout: 12_000 });

  const emailInput = page.getByPlaceholder("Email").first();
  const passwordInput = page.getByPlaceholder("Password").first();
  const credentialsButton = page.getByRole("button", { name: "Sign in with Email" }).first();
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(credentialsButton).toBeVisible();
  await emailInput.click();
  await emailInput.fill("");
  await emailInput.type(email, { delay: 15 });
  await passwordInput.click();
  await passwordInput.fill("");
  await passwordInput.type(password, { delay: 15 });
  await expect(credentialsButton).toBeEnabled();
  await credentialsButton.click();
  await page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/callback/credentials") && res.request().method() === "POST",
    { timeout: 20_000 },
  );

  const sessionRes = await page.request.get("/api/auth/session");
  const sessionJson = (await sessionRes.json().catch(() => null)) as { user?: { email?: string } } | null;
  if (!sessionJson?.user?.email) {
    throw new Error(`Credentials sign-in did not establish session for ${email}`);
  }

  await page.waitForTimeout(400);
  if (page.url().includes("/login")) {
    try {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 8_000 });
    } catch {
      await page.goto("/me", { waitUntil: "domcontentloaded", timeout: 8_000 });
    }
  }
}
