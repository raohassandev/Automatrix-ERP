import { test, expect, request, devices } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ROLE_EMAILS = {
  engineer: "engineer1@automatrix.pk",
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

test.describe.serial("Project Work Hub actions (RBAC + mobile)", () => {
  let projectDbId = "";
  const states = {
    engineer: "playwright/.auth/engineer.json",
    store: "playwright/.auth/store.json",
    finance: "playwright/.auth/finance.json",
  } as const;

  test.beforeAll(async ({ browser, baseURL }) => {
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.finance, states.finance);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.engineer, states.engineer);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.store, states.store);

    const api = await request.newContext({ baseURL, storageState: states.finance });
    const ts = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    const clientRes = await api.post("/api/clients", { data: { name: `E2E WH Client ${ts}` } });
    expect(clientRes.ok()).toBeTruthy();
    const clientJson = await clientRes.json();
    const clientId: string = clientJson.data.id;

    const projectRes = await api.post("/api/projects", {
      data: {
        projectId: `PRJ-E2E-WH-${ts}`,
        name: `E2E Project WorkHub ${ts}`,
        clientId,
        startDate: today,
        status: "ACTIVE",
        contractValue: 0,
      },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectJson = await projectRes.json();
    projectDbId = projectJson.data.id;

    // Assign engineer + store to project so project-scope checks pass for them.
    const usersRes = await api.get("/api/users/list");
    expect(usersRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const byEmail = new Map<string, string>(
      (usersJson.data || []).map((u: { email: string; id: string }) => [String(u.email).toLowerCase(), u.id]),
    );

    const assignRes = await api.post(`/api/projects/${projectDbId}/assignments`, {
      data: {
        assignments: [
          { userId: byEmail.get(ROLE_EMAILS.engineer)! },
          { userId: byEmail.get(ROLE_EMAILS.store)! },
        ],
      },
    });
    expect(assignRes.ok()).toBeTruthy();

    await api.dispose();
  });

  test("Finance: sees procurement + assign + note/attachment actions", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.finance });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await page.getByTestId("workhub-actions-button").first().click();
    await expect(page.getByRole("menuitem", { name: "Create Purchase Order for this Project" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Receive Goods (GRN) for this Project" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Create Vendor Bill for this Project" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Assign People to Project" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Add Project Note" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Add Attachment (URL)" }).first()).toBeVisible();
    await ctx.close();
  });

  test("Engineer: note/attachment only (no procurement actions, no assign)", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await page.getByTestId("workhub-actions-button").first().click();
    await expect(page.getByRole("menuitem", { name: "Add Project Note" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Add Attachment (URL)" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Create Purchase Order for this Project" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Assign People to Project" })).toHaveCount(0);
    await ctx.close();
  });

  test("Store: note/attachment only; API-negative for assignments returns 403", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.store });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await page.getByTestId("workhub-actions-button").first().click();
    await expect(page.getByRole("menuitem", { name: "Add Project Note" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Add Attachment (URL)" }).first()).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Assign People to Project" })).toHaveCount(0);
    await ctx.close();

    const api = await request.newContext({ baseURL, storageState: states.store });
    const res = await api.post(`/api/projects/${projectDbId}/assignments`, { data: { assignments: [] } });
    expect(res.status()).toBe(403);
    await api.dispose();
  });

  test("Mobile (iPhone 13): actions dropdown opens", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL,
      storageState: states.finance,
    });
    const page = await ctx.newPage();
    await page.goto(`/projects/${projectDbId}`);
    await page.getByTestId("workhub-actions-button").first().click();
    await expect(page.getByRole("menuitem", { name: "Add Project Note" }).first()).toBeVisible();
    await ctx.close();
  });
});
