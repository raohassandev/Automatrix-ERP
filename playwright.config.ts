import { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  testDir: "playwright/tests",
  timeout: 60 * 1000,
  expect: { timeout: 5000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev -- --hostname 0.0.0.0 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
};

export default config;
