import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "playwright/tests",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://erp-staging.automatrix.pk",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  workers: 1,
});
