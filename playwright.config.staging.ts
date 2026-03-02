import { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "playwright/tests",
  timeout: 120 * 1000,
  expect: { timeout: 15 * 1000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report-staging", open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://erp-staging.automatrix.pk",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  workers: 1,
};

export default config;
