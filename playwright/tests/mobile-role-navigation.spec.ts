import { expect, test, devices } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ACCOUNTS = {
  owner: process.env.E2E_OWNER_EMAIL || "israrulhaq5@gmail.com",
  finance: process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk",
  engineer: process.env.E2E_ENGINEER_EMAIL || "engineer1@automatrix.pk",
  store: process.env.E2E_STORE_EMAIL || "store1@automatrix.pk",
  sales: process.env.E2E_SALES_EMAIL || "sales1@automatrix.pk",
} as const;

async function openMobileMenu(page: import("@playwright/test").Page) {
  const namedTrigger = page.getByRole("button", { name: /open navigation menu/i });
  if (await namedTrigger.count()) {
    await namedTrigger.first().click();
    return;
  }
  await page.locator("header button").first().click();
}

function visibleLink(page: import("@playwright/test").Page, text: RegExp) {
  return page.locator("a:visible", { hasText: text }).first();
}

test.describe("Mobile role navigation smoke", () => {
  test("Owner menu contains CEO routes", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL });
    const page = await ctx.newPage();
    await loginAs(page, ACCOUNTS.owner);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openMobileMenu(page);
    await expect(visibleLink(page, /^CEO Dashboard$/i)).toBeVisible();
    await expect(visibleLink(page, /^Settings$/i)).toBeVisible();
    await ctx.close();
  });

  test("Engineer menu excludes accounting links", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL });
    const page = await ctx.newPage();
    await loginAs(page, ACCOUNTS.engineer);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openMobileMenu(page);
    await expect(visibleLink(page, /^Projects$/i)).toBeVisible();
    await expect(page.locator("a:visible", { hasText: /Profit & Loss/i })).toHaveCount(0);
    await expect(page.locator("a:visible", { hasText: /Chart of Accounts/i })).toHaveCount(0);
    await ctx.close();
  });

  test("Sales menu excludes inventory and settings", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL });
    const page = await ctx.newPage();
    await loginAs(page, ACCOUNTS.sales);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openMobileMenu(page);
    await expect(page.locator("a:visible", { hasText: /^Inventory$/i })).toHaveCount(0);
    await expect(page.locator("a:visible", { hasText: /^Settings$/i })).toHaveCount(0);
    await ctx.close();
  });

  test("Store has inventory link and no accounting links", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL });
    const page = await ctx.newPage();
    await loginAs(page, ACCOUNTS.store);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openMobileMenu(page);
    await expect(visibleLink(page, /^Inventory$/i)).toBeVisible();
    await expect(page.locator("a:visible", { hasText: /Chart of Accounts/i })).toHaveCount(0);
    await ctx.close();
  });

  test("Finance menu includes finance and accounting links", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL });
    const page = await ctx.newPage();
    await loginAs(page, ACCOUNTS.finance);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await openMobileMenu(page);
    await expect(visibleLink(page, /^Chart of Accounts$/i)).toBeVisible();
    await expect(visibleLink(page, /^AP Aging$/i)).toBeVisible();
    await ctx.close();
  });
});
