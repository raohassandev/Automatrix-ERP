import fs from "node:fs/promises";
import path from "node:path";
import { test, expect, devices, type Page } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";
const DATE_STAMP = new Date().toISOString().slice(0, 10);
const OUT_DIR = path.join("artifacts", "ui-theme-sweep", DATE_STAMP);

const desktopRoutes = [
  "/dashboard",
  "/projects",
  "/projects/financial",
  "/expenses",
  "/income",
  "/inventory",
  "/procurement/purchase-orders",
  "/procurement/grn",
  "/procurement/vendor-bills",
  "/procurement/vendor-payments",
  "/company-accounts",
  "/accounting/journals",
  "/approvals",
  "/employees",
  "/payroll",
  "/hrms/attendance",
  "/hrms/leave",
  "/settings",
  "/master-data",
  "/reports",
  "/me",
];

const mobileRoutes = [
  "/dashboard",
  "/projects",
  "/expenses",
  "/inventory",
  "/approvals",
  "/me",
  "/settings",
];

function slugRoute(route: string) {
  return route === "/" ? "home" : route.replace(/^\//, "").replace(/[/?=&]/g, "-");
}

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((nextTheme) => {
    window.localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(nextTheme);
  }, theme);
}

async function safeGoto(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(350);
}

async function clickLikelyCreateAction(page: Page) {
  const selectors = [
    "button.fixed.bottom-6.right-6",
    "button:has-text('Add')",
    "button:has-text('Create')",
    "button:has-text('Log')",
    "button:has-text('Submit')",
    "a:has-text('Add')",
    "a:has-text('Create')",
  ];
  for (const selector of selectors) {
    const target = page.locator(selector).first();
    if (await target.isVisible().catch(() => false)) {
      await target.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(350);
      return true;
    }
  }
  return false;
}

async function capturePageAndForm(
  page: Page,
  route: string,
  mode: "desktop" | "mobile",
  theme: "light" | "dark",
  findings: string[],
) {
  await safeGoto(page, route);
  await expect(page.locator("main")).toBeVisible();

  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
  if (overflowX) findings.push(`[${mode}/${theme}] horizontal overflow: ${route}`);

  const routeSlug = slugRoute(route);
  await page.screenshot({
    path: path.join(OUT_DIR, `${mode}-${theme}-${routeSlug}.png`),
    fullPage: true,
  });

  const opened = await clickLikelyCreateAction(page);
  if (!opened) return;

  const hasDialog = await page.locator("[role='dialog'], [data-state='open'][role='dialog']").first().isVisible().catch(() => false);
  if (!hasDialog) {
    await page.keyboard.press("Escape").catch(() => {});
    return;
  }

  await page.screenshot({
    path: path.join(OUT_DIR, `${mode}-${theme}-${routeSlug}-form.png`),
    fullPage: true,
  });
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(150);
}

test.describe("Theme deep screenshot sweep", () => {
  test("desktop light/dark + mobile capture and UX checks", async ({ browser }) => {
    test.setTimeout(480_000);
    await fs.mkdir(OUT_DIR, { recursive: true });
    const findings: string[] = [];

    const desktopCtx = await browser.newContext({ viewport: { width: 1600, height: 980 } });
    const desktopPage = await desktopCtx.newPage();
    await loginAs(desktopPage, FINANCE_EMAIL);

    for (const theme of ["light", "dark"] as const) {
      await setTheme(desktopPage, theme);
      for (const route of desktopRoutes) {
        await capturePageAndForm(desktopPage, route, "desktop", theme, findings);
      }
    }

    await safeGoto(desktopPage, "/projects");
    const firstProject = desktopPage.locator("a[href^='/projects/']").first();
    if (await firstProject.isVisible().catch(() => false)) {
      await firstProject.click();
      await desktopPage.waitForLoadState("domcontentloaded");
      await desktopPage.screenshot({
        path: path.join(OUT_DIR, "desktop-dark-project-detail.png"),
        fullPage: true,
      });
    } else {
      findings.push("[desktop] project detail not captured (no row link found)");
    }

    await desktopCtx.close();

    const mobileCtx = await browser.newContext({ ...devices["iPhone 13"] });
    const mobilePage = await mobileCtx.newPage();
    await loginAs(mobilePage, FINANCE_EMAIL);
    await setTheme(mobilePage, "dark");

    for (const route of mobileRoutes) {
      await capturePageAndForm(mobilePage, route, "mobile", "dark", findings);
    }

    const menuButton = mobilePage.locator("button:has(svg.lucide-menu), button[aria-label*='menu' i]").first();
    await mobilePage.keyboard.press("Escape").catch(() => {});
    await mobilePage.locator("div.fixed.inset-0.bg-black\\/20").click({ position: { x: 5, y: 5 }, timeout: 500 }).catch(() => {});
    await mobilePage.waitForTimeout(120);
    if (await menuButton.isVisible().catch(() => false)) {
      await menuButton.click({ timeout: 1200 }).then(async () => {
        await mobilePage.waitForTimeout(250);
        await mobilePage.screenshot({
          path: path.join(OUT_DIR, "mobile-dark-menu-open.png"),
          fullPage: true,
        });
      }).catch(() => {
        findings.push("[mobile] menu capture skipped due persistent overlay intercept");
      });
    } else {
      findings.push("[mobile] menu button not found for capture");
    }

    await mobileCtx.close();

    await fs.writeFile(
      path.join(OUT_DIR, "THEME_SWEEP_FINDINGS.txt"),
      findings.length ? findings.join("\n") : "No overflow/layout issues detected by automated checks.",
      "utf8",
    );

    expect(findings).toEqual([]);
  });
});
