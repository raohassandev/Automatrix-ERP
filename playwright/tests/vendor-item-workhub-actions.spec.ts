import { test, expect, request, devices } from "@playwright/test";

const ROLE_EMAILS = {
  engineer: "engineer1@automatrix.pk",
  sales: "sales1@automatrix.pk",
  store: "store1@automatrix.pk",
  finance: "finance1@automatrix.pk",
} as const;

async function uiLogin(page: import("@playwright/test").Page, email: string) {
  const password = process.env.E2E_TEST_PASSWORD || "e2e";
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "E2E Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
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

test.describe.serial("Vendor + Item Work Hub actions (RBAC + mobile)", () => {
  let vendorDbId = "";
  let itemDbId = "";
  let projectDbId = "";
  let otherUserId = "";
  const states = {
    engineer: "playwright/.auth/engineer.json",
    sales: "playwright/.auth/sales.json",
    store: "playwright/.auth/store.json",
    finance: "playwright/.auth/finance.json",
  } as const;

  test.beforeAll(async ({ browser, baseURL }) => {
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.finance, states.finance);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.engineer, states.engineer);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.sales, states.sales);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.store, states.store);

    const api = await request.newContext({ baseURL, storageState: states.finance });
    const ts = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    const vendorRes = await api.post("/api/vendors", { data: { name: `E2E WH Vendor ${ts}`, status: "ACTIVE" } });
    expect(vendorRes.ok()).toBeTruthy();
    vendorDbId = (await vendorRes.json()).data.id;

    const itemRes = await api.post("/api/inventory", {
      data: { name: `E2E WH Item ${ts}`, category: "E2E", unit: "pcs", sku: `SKU-WH-${ts}`, sellingPrice: 0, unitCost: 10 },
    });
    expect(itemRes.ok()).toBeTruthy();
    itemDbId = (await itemRes.json()).data.id;

    const clientRes = await api.post("/api/clients", { data: { name: `E2E WH Client ${ts}` } });
    expect(clientRes.ok()).toBeTruthy();
    const clientId = (await clientRes.json()).data.id as string;

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
    projectDbId = (await projectRes.json()).data.id as string;

    // Assign engineer + store to project so project-scope checks pass for them.
    const usersRes = await api.get("/api/users/list");
    expect(usersRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const byEmail = new Map<string, string>(
      (usersJson.data || []).map((u: { email: string; id: string }) => [String(u.email).toLowerCase(), u.id]),
    );
    otherUserId = byEmail.get(ROLE_EMAILS.finance) || "";

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

  test("Project actions: finance sees procurement + assign + note; engineer/store note only; API-negative store cannot assign", async ({
    browser,
    baseURL,
  }) => {
    // Finance
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/projects/${projectDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Create Purchase Order for this Project")).toBeVisible();
      await expect(page.getByText("Receive Goods (GRN) for this Project")).toBeVisible();
      await expect(page.getByText("Create Vendor Bill for this Project")).toBeVisible();
      await expect(page.getByText("Assign People to Project")).toBeVisible();
      await expect(page.getByText("Add Project Note")).toBeVisible();
      await ctx.close();
    }

    // Engineer
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
      const page = await ctx.newPage();
      await page.goto(`/projects/${projectDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Add Project Note")).toBeVisible();
      await expect(page.getByText("Assign People to Project")).toHaveCount(0);
      await expect(page.getByText("Create Purchase Order for this Project")).toHaveCount(0);
      await ctx.close();
    }

    // Store
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.store });
      const page = await ctx.newPage();
      await page.goto(`/projects/${projectDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Add Project Note")).toBeVisible();
      await expect(page.getByText("Assign People to Project")).toHaveCount(0);
      await ctx.close();

      const api = await request.newContext({ baseURL, storageState: states.store });
      const res = await api.post(`/api/projects/${projectDbId}/assignments`, { data: { assignments: [] } });
      expect(res.status()).toBe(403);
      await api.dispose();
    }
  });

  test("Vendor actions: finance sees Payment; engineer/store do not", async ({ browser, baseURL }) => {
    // Finance
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/vendors/${vendorDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Record Vendor Payment")).toBeVisible();
      await expect(page.getByText("Create PO for this Vendor")).toBeVisible();
      await expect(page.getByText("Create Vendor Bill for this Vendor")).toBeVisible();
      await ctx.close();
    }

    // Engineer
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
      const page = await ctx.newPage();
      await page.goto(`/vendors/${vendorDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Add Vendor Note")).toBeVisible();
      await expect(page.getByText("Record Vendor Payment")).toHaveCount(0);
      await expect(page.getByText("Create Vendor Bill for this Vendor")).toHaveCount(0);
      await ctx.close();
    }

    // Store
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.store });
      const page = await ctx.newPage();
      await page.goto(`/vendors/${vendorDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Add Vendor Attachment (URL)")).toBeVisible();
      await expect(page.getByText("Record Vendor Payment")).toHaveCount(0);
      await ctx.close();
    }
  });

  test("Employee access: /me works for all roles; /employees/[id] forbidden for non-HR", async ({ browser, baseURL }) => {
    // /me must load for all roles
    for (const role of ["finance", "engineer", "sales", "store"] as const) {
      const ctx = await browser.newContext({ baseURL, storageState: states[role] });
      const page = await ctx.newPage();
      await page.goto("/me");
      await expect(page.getByRole("heading", { name: /My Dashboard/i })).toBeVisible();
      await ctx.close();
    }

    // /employees/[id] should be blocked for store/engineer/sales (HR/Finance only)
    for (const role of ["engineer", "sales", "store"] as const) {
      const ctx = await browser.newContext({ baseURL, storageState: states[role] });
      const page = await ctx.newPage();
      await page.goto(`/employees/${otherUserId}`);
      await expect(page.getByText("You do not have access to employee details.")).toBeVisible();
      await ctx.close();
    }
  });

  test("API-negative: Sales cannot create vendor payment (403)", async ({ baseURL }) => {
    const api = await request.newContext({ baseURL, storageState: states.sales });
    const today = new Date().toISOString().slice(0, 10);
    const res = await api.post("/api/procurement/vendor-payments", {
      data: {
        paymentNumber: `PAY-E2E-WH-${Date.now()}`,
        vendorId: vendorDbId,
        projectRef: "PRJ-INVALID",
        paymentDate: today,
        companyAccountId: "invalid",
        amount: 1,
      },
    });
    expect(res.status()).toBe(403);
    await api.dispose();
  });

  test("Item actions: finance sees Start PO; store does not; API-negative store cannot create PO", async ({
    browser,
    baseURL,
  }) => {
    // Finance
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Start Purchase Order with this Item")).toBeVisible();
      await ctx.close();
    }

    // Store
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.store });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemDbId}`);
      await page.getByRole("button", { name: "Actions" }).click();
      await expect(page.getByText("Start Purchase Order with this Item")).toHaveCount(0);
      await ctx.close();

      const api = await request.newContext({ baseURL, storageState: states.store });
      const today = new Date().toISOString().slice(0, 10);
      const poRes = await api.post("/api/procurement/purchase-orders", {
        data: {
          poNumber: `PO-E2E-WH-${Date.now()}`,
          vendorName: "X",
          projectRef: "PRJ-X",
          orderDate: today,
          currency: "PKR",
          items: [{ itemName: "X", quantity: 1, unitCost: 1 }],
        },
      });
      expect(poRes.status()).toBe(403);
      await api.dispose();
    }
  });

  test("Mobile (iPhone 13): Vendor + Item actions menus open", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL, storageState: states.finance });
    const page = await ctx.newPage();

    await page.goto(`/projects/${projectDbId}`);
    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByText("Add Project Note")).toBeVisible();

    await page.goto(`/vendors/${vendorDbId}`);
    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByText("Add Vendor Note")).toBeVisible();

    await page.goto(`/inventory/items/${itemDbId}`);
    await page.getByRole("button", { name: "Actions" }).click();
    await expect(page.getByText("Add Item Note")).toBeVisible();

    await ctx.close();
  });
});
