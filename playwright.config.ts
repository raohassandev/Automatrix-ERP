import { PlaywrightTestConfig } from "@playwright/test";

const e2eDbUrl = process.env.E2E_DATABASE_URL;
const allowRealDb = process.env.PLAYWRIGHT_ALLOW_REAL_DB === "1";
if (!e2eDbUrl && !allowRealDb) {
  throw new Error(
    [
      "Playwright safety guardrail:",
      "- Refusing to run e2e against your real DATABASE_URL by default.",
      "- Set E2E_DATABASE_URL to a dedicated throwaway database, or set PLAYWRIGHT_ALLOW_REAL_DB=1 to override.",
      "",
      "Example:",
      "  E2E_DATABASE_URL='postgresql://.../automatrix_erp_e2e' pnpm test:e2e",
    ].join("\n")
  );
}

const config: PlaywrightTestConfig = {
  testDir: "playwright/tests",
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  reporter: "list",
  use: {
    // Keep host consistent with NEXTAUTH_URL to avoid cookie/session host mismatch.
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    env: {
      ...process.env,
      // Enable E2E-only credentials login (never enabled in prod/staging).
      E2E_TEST_MODE: "1",
      NEXT_PUBLIC_E2E_TEST_MODE: "1",
      E2E_BOOTSTRAP: process.env.E2E_BOOTSTRAP || "1",
      E2E_TEST_PASSWORD: process.env.E2E_TEST_PASSWORD || "e2e",
      E2E_TEST_ROLE: process.env.E2E_TEST_ROLE || "Admin",
      // Avoid auth boot failure if developer hasn't set Google env vars locally.
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "dummy",
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "dummy",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
      AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "e2e-secret",
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || "true",
      CI: process.env.CI || "true",
      DATABASE_URL: e2eDbUrl || process.env.DATABASE_URL || "",
    },
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
};

export default config;
