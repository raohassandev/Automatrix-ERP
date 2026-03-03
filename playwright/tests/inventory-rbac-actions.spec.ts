import { expect, request, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ROLE_EMAILS = {
  finance: process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk",
  engineer: process.env.E2E_ENGINEER_EMAIL || "engineer1@automatrix.pk",
} as const;

async function ensureStorageState(
  browser: import("@playwright/test").Browser,
  baseURL: string | undefined,
  email: string,
  path: string,
) {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await loginAs(page, email);
  await ctx.storageState({ path });
  await ctx.close();
}

test.describe.serial("Inventory RBAC actions", () => {
  let itemId = "";
  let itemName = "";
  const states = {
    finance: "playwright/.auth/inv-rbac-finance.json",
    engineer: "playwright/.auth/inv-rbac-engineer.json",
  } as const;

  test.beforeAll(async ({ browser, baseURL }) => {
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.finance, states.finance);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.engineer, states.engineer);

    const api = await request.newContext({ baseURL, storageState: states.finance });
    const ts = Date.now();
    itemName = `E2E RBAC Item ${ts}`;
    const createItem = await api.post("/api/inventory", {
      data: {
        name: itemName,
        sku: `E2E-RBAC-${ts}`,
        category: "E2E",
        unit: "pcs",
        unitCost: 100,
        sellingPrice: 150,
        initialQuantity: 3,
      },
    });
    expect(createItem.ok()).toBeTruthy();
    const json = await createItem.json();
    itemId = json.data.id;
    await api.dispose();
  });

  test.afterAll(async ({ baseURL }) => {
    if (!itemId) return;
    const api = await request.newContext({ baseURL, storageState: states.finance });
    await api.delete(`/api/inventory/${itemId}`);
    await api.dispose();
  });

  test("Finance sees full inventory actions", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.finance });
    const page = await ctx.newPage();
    await page.goto(`/inventory?search=${encodeURIComponent(itemName)}`);

    const row = page.locator("tr", { hasText: itemName }).first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /Stock In\/Out/i })).toBeVisible();
    await expect(row.getByRole("button", { name: /Allocate to Project/i })).toBeVisible();
    await expect(row.getByRole("button", { name: /^Edit$/i })).toBeVisible();
    await expect(row.getByRole("button", { name: /^Delete$/i })).toBeVisible();
    await ctx.close();
  });

  test("Engineer does not see edit/delete or stock movement", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
    const page = await ctx.newPage();
    await page.goto(`/inventory?search=${encodeURIComponent(itemName)}`);

    const row = page.locator("tr", { hasText: itemName }).first();
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /Stock In\/Out/i })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /^Edit$/i })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /^Delete$/i })).toHaveCount(0);
    await ctx.close();
  });

  test("Item detail actions follow effective permissions", async ({ browser, baseURL }) => {
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemId}`);
      await expect(page.getByTestId("workhub-actions-button")).toBeVisible();
      await page.getByTestId("workhub-actions-button").click();
      await expect(page.getByRole("menuitem", { name: /Start Purchase Order with this Item/i })).toBeVisible();
      await ctx.close();
    }

    {
      const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemId}`);
      await expect(page.getByTestId("workhub-actions-button")).toBeVisible();
      await page.getByTestId("workhub-actions-button").click();
      await expect(page.getByRole("menuitem", { name: /Start Purchase Order with this Item/i })).toHaveCount(0);
      await expect(page.getByRole("menuitem", { name: /Add Item Note/i })).toBeVisible();
      await ctx.close();
    }
  });
});
