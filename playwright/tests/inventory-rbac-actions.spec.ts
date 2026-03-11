import { expect, request, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ROLE_EMAILS = {
  finance: process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk",
  engineer: process.env.E2E_ENGINEER_EMAIL || "engineer1@automatrix.pk",
} as const;

async function getEffectivePermissions(
  baseURL: string | undefined,
  storageStatePath: string,
): Promise<Set<string>> {
  const api = await request.newContext({ baseURL, storageState: storageStatePath });
  const res = await api.get("/api/me/effective-permissions");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  await api.dispose();
  return new Set<string>(Array.isArray(json?.permissions) ? json.permissions : []);
}

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
  test.describe.configure({ timeout: 240_000 });
  test.setTimeout(180_000);
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
    await page.goto(`/inventory?search=${encodeURIComponent(itemName)}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

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
    await page.goto(`/inventory?search=${encodeURIComponent(itemName)}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

    const row = page.locator("tr", { hasText: itemName }).first();
    const hasRow = await row.isVisible().catch(() => false);
    if (hasRow) {
      await expect(row.getByRole("button", { name: /Stock In\/Out/i })).toHaveCount(0);
      await expect(row.getByRole("button", { name: /^Edit$/i })).toHaveCount(0);
      await expect(row.getByRole("button", { name: /^Delete$/i })).toHaveCount(0);
    } else {
      // Restricted users can have inventory hidden entirely. Ensure no management controls leak.
      await expect(page.getByRole("button", { name: /Add Inventory/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /Stock In\/Out/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Edit$/i })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Delete$/i })).toHaveCount(0);
    }
    await ctx.close();
  });

  test("Item detail actions follow effective permissions", async ({ browser, baseURL }) => {
    const financePerms = await getEffectivePermissions(baseURL, states.finance);
    const engineerPerms = await getEffectivePermissions(baseURL, states.engineer);
    const financeCanProcure = financePerms.has("procurement.edit") && financePerms.has("procurement.view_all");
    const engineerCanProcure = engineerPerms.has("procurement.edit") && engineerPerms.has("procurement.view_all");
    const engineerCanAccessItem =
      engineerPerms.has("inventory.view") || engineerPerms.has("inventory.view_selling");

    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemId}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await expect(page.getByTestId("workhub-actions-button")).toBeVisible();
      await page.getByTestId("workhub-actions-button").click();
      if (financeCanProcure) {
        await expect(page.getByRole("menuitem", { name: /Start Purchase Order with this Item/i })).toBeVisible();
      } else {
        await expect(page.getByRole("menuitem", { name: /Start Purchase Order with this Item/i })).toHaveCount(0);
      }
      await ctx.close();
    }

    {
      const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemId}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      if (!engineerCanAccessItem) {
        await expect(page.getByRole("heading", { name: /Access Denied/i })).toBeVisible();
        await expect(page.getByText("You do not have permission to open this page.")).toBeVisible();
        await ctx.close();
        return;
      }
      await expect(page.getByTestId("workhub-actions-button")).toBeVisible();
      await page.getByTestId("workhub-actions-button").click();
      if (engineerCanProcure) {
        await expect(page.getByRole("menuitem", { name: /Start Purchase Order with this Item/i })).toBeVisible();
      } else {
        await expect(page.getByRole("menuitem", { name: /Start Purchase Order with this Item/i })).toHaveCount(0);
      }
      await expect(page.getByRole("menuitem", { name: /Add Item Note/i })).toBeVisible();
      await ctx.close();
    }
  });
});
