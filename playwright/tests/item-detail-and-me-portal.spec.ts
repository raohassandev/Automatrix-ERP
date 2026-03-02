import { test, expect, request, devices } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ROLE_EMAILS = {
  sales: "sales1@automatrix.pk",
  store: "store1@automatrix.pk",
  finance: "finance1@automatrix.pk",
} as const;

async function uiLogin(page: import("@playwright/test").Page, email: string) {
  await loginAs(page, email);
}

async function ensureStorageState(
  browser: import("@playwright/test").Browser,
  baseURL: string | undefined,
  email: string,
  path: string,
) {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await uiLogin(page, email);
  await ctx.storageState({ path });
  await ctx.close();
}

test.describe.serial("Item Detail + My Portal (RBAC + mobile)", () => {
  let itemId = "";
  let employeeId = "";
  const states = {
    sales: "playwright/.auth/sales.json",
    store: "playwright/.auth/store.json",
    finance: "playwright/.auth/finance.json",
  } as const;

  test.beforeAll(async ({ browser, baseURL }) => {
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.finance, states.finance);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.store, states.store);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.sales, states.sales);

    const api = await request.newContext({ baseURL, storageState: states.finance });
    const ts = Date.now();

    // Create an inventory item (finance has inventory.adjust + view_cost).
    const createItem = await api.post("/api/inventory", {
      data: { name: `E2E Item ${ts}`, category: "E2E", unit: "pcs", sku: `SKU-${ts}`, sellingPrice: 0, unitCost: 100 },
    });
    expect(createItem.ok()).toBeTruthy();
    const itemJson = await createItem.json();
    itemId = itemJson.data.id;

    // Add a ledger entry so Activity/Ledger tabs have content.
    const ledgerRes = await api.post("/api/inventory/ledger", {
      data: { itemId, type: "ADJUSTMENT", quantity: 2, unitCost: 100, reference: `ADJ-${ts}` },
    });
    expect(ledgerRes.ok()).toBeTruthy();

    // Pick any employee id for access checks.
    const employeesRes = await api.get("/api/employees");
    expect(employeesRes.ok()).toBeTruthy();
    const employeesJson = await employeesRes.json();
    employeeId = employeesJson.data?.[0]?.id || "";
    expect(employeeId).toBeTruthy();

    await api.dispose();
  });

  test("Finance: Item detail shows costs; Store: costs absent; Sales: on-hand only", async ({ browser, baseURL }) => {
    // Finance UI
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemId}`);
      await expect(page.locator("button:visible", { hasText: /^Ledger$/ }).first()).toBeVisible();
      await page.locator("button:visible", { hasText: /^Ledger$/ }).first().click();
      await expect(page.getByText("Unit Cost")).toBeVisible();
      await expect(page.getByText("Total")).toBeVisible();
      await ctx.close();
    }

    // Store UI
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.store });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemId}`);
      await expect(page.locator("button:visible", { hasText: /^Ledger$/ }).first()).toBeVisible();
      await page.locator("button:visible", { hasText: /^Ledger$/ }).first().click();
      await expect(page.getByText("Unit Cost")).toHaveCount(0);
      await expect(page.getByText("Total")).toHaveCount(0);
      await ctx.close();
    }

    // Sales UI (availability-only view)
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.sales });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemId}`);
      await expect(page.locator("button:visible", { hasText: /^Ledger$/ })).toHaveCount(0);
      await expect(page.locator("button:visible", { hasText: /^Documents$/ })).toHaveCount(0);
      await ctx.close();
    }
  });

  test("API negative: Store item detail omits unitCost/total fields", async ({ baseURL }) => {
    const api = await request.newContext({ baseURL, storageState: states.store });
    const res = await api.get(`/api/inventory/items/${itemId}/detail?ledgerPage=1`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    const text = JSON.stringify(json);
    expect(text.includes("unitCost")).toBeFalsy();
    expect(text.includes("\"total\"")).toBeFalsy();
    await api.dispose();
  });

  test("My Portal: each role can load /me; non-HR cannot open /employees/[id]", async ({ browser, baseURL }) => {
    // Finance can load /me
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto("/me");
      await expect(page.getByRole("heading", { name: "My Dashboard" }).first()).toBeVisible();
      await ctx.close();
    }

    // Store can load /me (own)
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.store });
      const page = await ctx.newPage();
      await page.goto("/me");
      await expect(page.getByRole("heading", { name: "My Dashboard" }).first()).toBeVisible();
      await page.goto(`/employees/${employeeId}`);
      await expect(page.getByRole("main").getByText(/do not have access/i).first()).toBeVisible();
      await ctx.close();
    }
  });

  test("Mobile (iPhone 13): inventory list -> item detail loads; tabs dropdown works; /me loads", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL, storageState: states.finance });
    const page = await ctx.newPage();
    await page.goto("/inventory");
    await page.getByRole("link", { name: /E2E Item/i }).first().click();
    await expect(page).toHaveURL(/\/inventory\/items\/.+/);

    const select = page.locator("select");
    await expect(select).toBeVisible();
    await select.selectOption({ label: "On-hand" });
    await expect(page.getByRole("heading", { name: "On-hand" })).toBeVisible();

    await page.goto("/me");
    await expect(page.getByRole("heading", { name: "My Dashboard" }).first()).toBeVisible();
    await ctx.close();
  });
});
