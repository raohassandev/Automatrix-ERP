import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password = process.env.E2E_TEST_PASSWORD || "e2e") {
  await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 45_000 });

  const credentialsPanel = page
    .locator("div.rounded-md.border.border-border.bg-muted\\/30.p-3.text-sm")
    .filter({ has: page.getByText("Email login (staging/internal)", { exact: true }) })
    .first();
  const emailInput = credentialsPanel.getByPlaceholder("Email").first();
  const passwordInput = credentialsPanel.getByPlaceholder("Password").first();
  const credentialsButton = credentialsPanel.getByRole("button", { name: "Sign in with Email" });
  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(credentialsButton).toBeVisible();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await emailInput.click();
    await emailInput.fill("");
    await emailInput.type(email, { delay: 20 });
    await passwordInput.click();
    await passwordInput.fill("");
    await passwordInput.type(password, { delay: 20 });
    if (await credentialsButton.isEnabled().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(350);
  }
  if (await credentialsButton.isEnabled().catch(() => false)) {
    await credentialsButton.click();
    await page.waitForTimeout(700);
  } else {
    // Fallback for occasional client-side state lag on staging login UI.
    const csrfRes = await page.request.get("/api/auth/csrf");
    const csrfJson = (await csrfRes.json().catch(() => null)) as { csrfToken?: string } | null;
    const csrfToken = csrfJson?.csrfToken;
    if (!csrfToken) {
      throw new Error(`Could not fetch CSRF token for credentials sign-in (${email})`);
    }
    await page.request.post("/api/auth/callback/credentials", {
      form: {
        csrfToken,
        email,
        password,
        callbackUrl: "/dashboard",
        json: "true",
      },
    });
    await page.waitForTimeout(700);
  }

  let sessionJson: { user?: { email?: string } } | null = null;
  for (let i = 0; i < 5; i += 1) {
    const sessionRes = await page.request.get("/api/auth/session");
    sessionJson = (await sessionRes.json().catch(() => null)) as { user?: { email?: string } } | null;
    if (sessionJson?.user?.email) break;
    await page.waitForTimeout(400);
  }
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
