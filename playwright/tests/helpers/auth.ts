import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password = process.env.E2E_TEST_PASSWORD || "e2e") {
  // Staging can briefly return 502 during PM2/nginx restart windows.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
    const isBadGateway = await page.getByText("502 Bad Gateway").first().isVisible().catch(() => false);
    if (!isBadGateway) {
      break;
    }
    await page.waitForTimeout(1200 * (attempt + 1));
  }

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
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await emailInput.click();
    await emailInput.fill("");
    await emailInput.fill(email);
    await passwordInput.click();
    await passwordInput.fill("");
    await passwordInput.fill(password);
    if (await credentialsButton.isEnabled().catch(() => false)) {
      break;
    }
    await page.waitForTimeout(200);
  }
  if (await credentialsButton.isEnabled().catch(() => false)) {
    await credentialsButton.click();
    await page.waitForTimeout(350);
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
    await page.waitForTimeout(350);
  }

  let sessionJson: { user?: { email?: string } } | null = null;
  for (let i = 0; i < 4; i += 1) {
    const sessionRes = await page.request.get("/api/auth/session");
    sessionJson = (await sessionRes.json().catch(() => null)) as { user?: { email?: string } } | null;
    if (sessionJson?.user?.email) break;
    await page.waitForTimeout(250);
  }
  if (!sessionJson?.user?.email) {
    throw new Error(`Credentials sign-in did not establish session for ${email}`);
  }

  await page.waitForTimeout(250);
  if (page.url().includes("/login")) {
    try {
      await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 12_000 });
    } catch {
      await page.goto("/me", { waitUntil: "domcontentloaded", timeout: 12_000 });
    }
  }
}
