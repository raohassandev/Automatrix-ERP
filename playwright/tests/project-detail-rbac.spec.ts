import { test, expect, request, devices } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ROLE_EMAILS = {
  engineer: "engineer1@automatrix.pk",
  sales: "sales1@automatrix.pk",
  technician: "technician1@automatrix.pk",
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

test.describe.serial("Project Detail (RBAC + mobile)", () => {
  let projectDbId = "";
  const states = {
    engineer: "playwright/.auth/engineer.json",
    sales: "playwright/.auth/sales.json",
    technician: "playwright/.auth/technician.json",
    store: "playwright/.auth/store.json",
    finance: "playwright/.auth/finance.json",
  } as const;

  test.beforeAll(async ({ browser, baseURL }) => {
    // Create storage states (also bootstraps these users/employees in E2E mode).
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.finance, states.finance);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.engineer, states.engineer);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.sales, states.sales);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.technician, states.technician);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.store, states.store);

    // Use Finance role to create a test project and assign all users to it.
    const api = await request.newContext({ baseURL, storageState: states.finance });
    const ts = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    const clientRes = await api.post("/api/clients", { data: { name: `E2E Client ${ts}` } });
    expect(clientRes.ok()).toBeTruthy();
    const clientJson = await clientRes.json();
    const clientId: string = clientJson.data.id;

    const projectRes = await api.post("/api/projects", {
      data: {
        projectId: `PRJ-E2E-DETAIL-${ts}`,
        name: `E2E Project Detail ${ts}`,
        clientId,
        startDate: today,
        status: "ACTIVE",
        contractValue: 0,
      },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectJson = await projectRes.json();
    projectDbId = projectJson.data.id;

    const usersRes = await api.get("/api/users/list");
    expect(usersRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const byEmail = new Map<string, string>(
      (usersJson.data || []).map((u: { email: string; id: string }) => [String(u.email).toLowerCase(), u.id]),
    );

    const assignments = Object.values(ROLE_EMAILS).map((email) => ({
      userId: byEmail.get(email.toLowerCase())!,
      role: "MEMBER",
    }));

    const assignRes = await api.post(`/api/projects/${projectDbId}/assignments`, { data: { assignments } });
    expect(assignRes.ok()).toBeTruthy();

    await api.dispose();
  });

  test("Finance: sees all tabs + unit costs", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.finance });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await expect(page.getByRole("heading", { name: "Project" })).toBeVisible({ timeout: 15_000 }).catch(() => {});
    await expect(page.locator("button:visible", { hasText: /^Activity$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Costs$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Inventory$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^People$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Documents$/ }).first()).toBeVisible();

    await page.locator("button:visible", { hasText: /^Inventory$/ }).first().click();
    await expect(page.getByRole("columnheader", { name: "Unit Cost" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Total" })).toBeVisible();
    await ctx.close();
  });

  test("Engineer: no Costs tab; has People; inventory costs masked", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await expect(page.locator("button:visible", { hasText: /^Activity$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Documents$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^People$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Costs$/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Inventory" }).click();
    await expect(page.getByText("Unit Cost")).toHaveCount(0);
    await expect(page.getByText("Total")).toHaveCount(0);
    await ctx.close();
  });

  test("Sales: docs-only view (no costs/inventory/people)", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.sales });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await expect(page.locator("button:visible", { hasText: /^Activity$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Documents$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Costs$/ })).toHaveCount(0);
    await expect(page.locator("button:visible", { hasText: /^Inventory$/ })).toHaveCount(0);
    await expect(page.locator("button:visible", { hasText: /^People$/ })).toHaveCount(0);
    await ctx.close();
  });

  test("Technician: inventory quantities only (no unit costs)", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.technician });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await expect(page.locator("button:visible", { hasText: /^Inventory$/ }).first()).toBeVisible();
    await page.getByRole("button", { name: "Inventory" }).click();
    await expect(page.getByText("Unit Cost")).toHaveCount(0);
    await expect(page.getByText("Total")).toHaveCount(0);
    await ctx.close();
  });

  test("Store: inventory movements only (no costs/people)", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.store });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await expect(page.locator("button:visible", { hasText: /^Inventory$/ }).first()).toBeVisible();
    await expect(page.locator("button:visible", { hasText: /^Costs$/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Inventory" }).click();
    await expect(page.getByText("Unit Cost")).toHaveCount(0);
    await ctx.close();
  });

  test("Mobile (iPhone 13): projects list click -> detail loads; tabs dropdown works", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL,
      storageState: states.finance,
    });
    const page = await ctx.newPage();
    await page.goto("/projects");
    await page.getByRole("link", { name: /E2E Project Detail/i }).first().click();
    await expect(page).toHaveURL(/\/projects\/.+/);

    // Mobile uses dropdown select for tabs.
    const select = page
      .locator("select")
      .filter({ has: page.locator("option", { hasText: /^Documents$/ }) })
      .first();
    await expect(select).toBeVisible();
    await select.selectOption({ label: "Documents" });
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await ctx.close();
  });

  test("Project finance export API: finance allowed, engineer forbidden", async ({ baseURL }) => {
    const financeApi = await request.newContext({ baseURL, storageState: states.finance });
    const financeRes = await financeApi.get(`/api/reports/projects/${projectDbId}/export`);
    expect(financeRes.status()).toBe(200);
    expect((await financeRes.text()).includes("Project Profit")).toBeTruthy();
    await financeApi.dispose();

    const engineerApi = await request.newContext({ baseURL, storageState: states.engineer });
    const engineerRes = await engineerApi.get(`/api/reports/projects/${projectDbId}/export`);
    expect(engineerRes.status()).toBe(403);
    await engineerApi.dispose();
  });

  test("Project finance report page: finance and engineer can load report scope", async ({ browser, baseURL }) => {
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto("/reports/projects");
      await expect(page.getByRole("heading", { name: "Project Financial Report" })).toBeVisible();
      await ctx.close();
    }
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
      const page = await ctx.newPage();
      await page.goto("/reports/projects");
      await expect(page.getByRole("heading", { name: "Project Financial Report" })).toBeVisible();
      await ctx.close();
    }
  });
});
