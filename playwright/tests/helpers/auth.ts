import { expect, type Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password = process.env.E2E_TEST_PASSWORD || "e2e") {
  for (let authAttempt = 0; authAttempt < 4; authAttempt += 1) {
    // Staging can briefly return 502 during PM2/nginx restart windows.
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await page.goto("/login", { waitUntil: "domcontentloaded", timeout: 30_000 });
      const isBadGateway = await page.getByText("502 Bad Gateway").first().isVisible().catch(() => false);
      if (!isBadGateway) {
        // If already signed in, /login can redirect away. Session check below handles this.
        const hasEmailField = await page.getByPlaceholder("Email").first().isVisible().catch(() => false);
        if (hasEmailField || !page.url().includes("/login")) {
          break;
        }
      }
      await page.waitForTimeout(1200 * (attempt + 1));
    }

    // Fast path: if session already exists, return without touching login form.
    const preSession = await page.request.get("/api/auth/session");
    const preSessionJson = (await preSession.json().catch(() => null)) as { user?: { email?: string } } | null;
    if (preSessionJson?.user?.email) {
      if (page.url().includes("/login")) {
        await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 12_000 }).catch(async () => {
          await page.goto("/me", { waitUntil: "domcontentloaded", timeout: 12_000 });
        });
      }
      return;
    }

    const emailInput = page.getByPlaceholder("Email").first();
    const passwordInput = page
      .getByPlaceholder("Password")
      .first()
      .or(page.locator('input[type="password"]').first());
    const credentialsButton = page.getByRole("button", { name: /Sign in with Email|E2E Sign in/i }).first();

    await expect(emailInput).toBeVisible();
    const hasPasswordField = await passwordInput.isVisible().catch(() => false);
    if (!hasPasswordField) {
      // Staging can intermittently render a partial login shell; retry auth loop instead of failing hard.
      await page.waitForTimeout(400 * (authAttempt + 1));
      continue;
    }
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
    const buttonLabel = ((await credentialsButton.textContent().catch(() => "")) || "").toLowerCase();
    const isE2EButton = buttonLabel.includes("e2e");

    if (await credentialsButton.isEnabled().catch(() => false)) {
      await credentialsButton.click();
      await page.waitForTimeout(350);
    } else if (!isE2EButton) {
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
    } else {
      throw new Error(`E2E sign-in button remained disabled for ${email}`);
    }

    let sessionJson: { user?: { email?: string } } | null = null;
    for (let i = 0; i < 4; i += 1) {
      const sessionRes = await page.request.get("/api/auth/session");
      sessionJson = (await sessionRes.json().catch(() => null)) as { user?: { email?: string } } | null;
      if (sessionJson?.user?.email) break;
      await page.waitForTimeout(250);
    }
    if (sessionJson?.user?.email) {
      await page.waitForTimeout(250);
      if (page.url().includes("/login")) {
        try {
          await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 12_000 });
        } catch {
          // Staging may perform a near-simultaneous redirect; fallback without failing auth.
          await page.goto("/me", { waitUntil: "domcontentloaded", timeout: 12_000 }).catch(async () => {
            await page.waitForTimeout(400);
          });
        }
      }
      return;
    }

    await page.waitForTimeout(600 * (authAttempt + 1));
  }

  throw new Error(`Credentials sign-in did not establish session for ${email}`);
}
