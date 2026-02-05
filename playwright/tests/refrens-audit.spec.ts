import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Refrens feature inventory crawler.
 *
 * IMPORTANT:
 * - Do NOT hardcode credentials in this file.
 * - Provide credentials via env vars when running locally:
 *   REFRENS_EMAIL="..." REFRENS_PASSWORD="..." pnpm playwright test refrens-audit
 *
 * Output:
 * - playwright/screenshots/refrens_features.json
 * - playwright/screenshots/refrens_features.txt
 */

test.describe("Refrens portal - feature inventory (navigation crawl)", () => {
  test("crawl nav + collect page titles", async ({ page }, testInfo) => {
    const email = process.env.REFRENS_EMAIL;
    const password = process.env.REFRENS_PASSWORD;

    if (!email || !password) {
      testInfo.skip(true, "Missing REFRENS_EMAIL/REFRENS_PASSWORD env vars");
      return;
    }

    const base = "https://www.refrens.com";
    const outDir = path.resolve(process.cwd(), "playwright/screenshots");
    fs.mkdirSync(outDir, { recursive: true });

    // 1) Login
    await page.goto(`${base}/app/`, { waitUntil: "domcontentloaded" });

    // Refrens may redirect; try to find login form inputs.
    // These selectors are intentionally permissive to survive minor UI changes.
    const emailInput = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]');
    const passwordInput = page.locator('input[type="password"], input[name*="password" i], input[placeholder*="password" i]');

    await emailInput.first().waitFor({ state: "visible", timeout: 30_000 });
    await emailInput.first().fill(email);
    await passwordInput.first().fill(password);

    // Click a "Login / Sign in" button.
    const loginButton = page
      .locator('button:has-text("Login"), button:has-text("Sign in"), button:has-text("Log in")')
      .first();
    await loginButton.click();

    // Wait for app shell / dashboard-like state.
    // We avoid relying on exact URL since SaaS apps can redirect.
    await page.waitForLoadState("networkidle", { timeout: 60_000 });

    // 2) Discover navigation links
    // Strategy:
    // - Collect all unique internal /app links visible in anchors.
    // - Filter out logout, help, external, empty anchors.
    const hrefs = await page
      .locator('a[href^="/app"], a[href^="https://www.refrens.com/app"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));

    const normalized = Array.from(
      new Set(
        hrefs
          .map((h) => {
            try {
              return new URL(h).toString();
            } catch {
              return "";
            }
          })
          .filter(Boolean)
          .filter((h) => h.includes("/app"))
          .filter((h) => !/logout|signout/i.test(h))
      )
    );

    // Always include landing /app/ in the results.
    const targets = Array.from(new Set([`${base}/app/`, ...normalized]));

    // 3) Visit each page and record a minimal “feature signature”
    const results: Array<{
      url: string;
      title: string;
      h1: string;
      headings: string[];
      navLabelHints: string[];
    }> = [];

    for (const url of targets) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 60_000 });

        const title = await page.title();
        const h1 = (await page.locator("h1").first().textContent().catch(() => ""))?.trim() || "";

        // Capture a few headings (helps infer feature areas without huge HTML dumps)
        const headings = await page
          .locator("h2, h3")
          .evaluateAll((els) =>
            els
              .map((e) => (e.textContent || "").trim())
              .filter(Boolean)
              .slice(0, 20)
          );

        // Capture visible nav labels as hints (first 50 text items)
        const navLabelHints = await page
          .locator("nav a, aside a")
          .evaluateAll((els) =>
            els
              .map((e) => (e.textContent || "").trim())
              .filter(Boolean)
              .slice(0, 50)
          );

        results.push({ url, title, h1, headings, navLabelHints });
      } catch (err) {
        results.push({
          url,
          title: "__ERROR__",
          h1: "",
          headings: [],
          navLabelHints: [String(err)],
        });
      }
    }

    // 4) Write outputs
    const jsonPath = path.join(outDir, "refrens_features.json");
    fs.writeFileSync(jsonPath, JSON.stringify({ crawledAt: new Date().toISOString(), targets, results }, null, 2));

    const lines: string[] = [];
    lines.push(`CrawledAt: ${new Date().toISOString()}`);
    lines.push(`Pages: ${results.length}`);
    lines.push("");

    for (const r of results) {
      lines.push(`- ${r.h1 || r.title || "(no title)"}`);
      lines.push(`  URL: ${r.url}`);
      if (r.headings.length) lines.push(`  Headings: ${r.headings.join(" | ")}`);
      lines.push("");
    }

    const txtPath = path.join(outDir, "refrens_features.txt");
    fs.writeFileSync(txtPath, lines.join("\n"));

    // Attach outputs to Playwright report
    await testInfo.attach("refrens_features.json", { path: jsonPath, contentType: "application/json" });
    await testInfo.attach("refrens_features.txt", { path: txtPath, contentType: "text/plain" });
  });
});
