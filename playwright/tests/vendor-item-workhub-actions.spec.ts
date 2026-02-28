import { test, expect, request, devices } from "@playwright/test";

const ROLE_EMAILS = {
  engineer: "engineer1@automatrix.pk",
  procurement: "procurement1@automatrix.pk",
  sales: "sales1@automatrix.pk",
  store: "store1@automatrix.pk",
  finance: "finance1@automatrix.pk",
} as const;

async function uiLogin(page: import("@playwright/test").Page, email: string) {
  const password = process.env.E2E_TEST_PASSWORD || "e2e";
  await page.goto("/login");
  const e2eBox = page.getByText("E2E login (local only)").locator("..");
  await e2eBox.getByPlaceholder("Email").fill(email);
  await e2eBox.getByPlaceholder("Password").fill(password);
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
  let vendorName = "";
  let itemDbId = "";
  let projectDbId = "";
  let otherUserId = "";
  let companyAccountId = "";
  const states = {
    engineer: "playwright/.auth/engineer.json",
    procurement: "playwright/.auth/procurement.json",
    sales: "playwright/.auth/sales.json",
    store: "playwright/.auth/store.json",
    finance: "playwright/.auth/finance.json",
  } as const;

  test.beforeAll(async ({ browser, baseURL }) => {
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.finance, states.finance);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.engineer, states.engineer);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.procurement, states.procurement);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.sales, states.sales);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.store, states.store);

    const api = await request.newContext({ baseURL, storageState: states.finance });
    const ts = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    vendorName = `E2E WH Vendor ${ts}`;
    const vendorRes = await api.post("/api/vendors", { data: { name: vendorName, status: "ACTIVE" } });
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

    // Create one vendor bill linked to the assigned project so restricted roles can access this vendor via project scope.
    const vendorScopeBillRes = await api.post("/api/procurement/vendor-bills", {
      data: {
        billNumber: `BILL-E2E-WH-${ts}`,
        vendorId: vendorDbId,
        projectRef: `PRJ-E2E-WH-${ts}`,
        billDate: today,
        currency: "PKR",
        lines: [{ description: "scope-link", total: 100 }],
      },
    });
    expect(vendorScopeBillRes.ok()).toBeTruthy();

    const accRes = await api.post("/api/company-accounts", {
      data: { name: `E2E WH Account ${ts}`, type: "CASH", currency: "PKR", openingBalance: 0, isActive: true },
    });
    expect(accRes.ok()).toBeTruthy();
    companyAccountId = (await accRes.json()).data.id;

    await api.dispose();
  });

  test("Sidebar nav parity: Vendor Payments visible to finance only", async ({ browser, baseURL }) => {
    // Finance: should see Vendor Payments in sidebar.
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto("/dashboard");
      await expect(page.locator("aside").getByRole("link", { name: "Vendor Payments" })).toBeVisible();
      await ctx.close();
    }

    // Procurement/Engineer/Store: should not see Vendor Payments in sidebar.
    for (const role of ["procurement", "engineer", "store"] as const) {
      const ctx = await browser.newContext({ baseURL, storageState: states[role] });
      const page = await ctx.newPage();
      await page.goto("/dashboard");
      await expect(page.locator("aside").getByRole("link", { name: "Vendor Payments" })).toHaveCount(0);
      await ctx.close();
    }
  });

  test("Company Account Detail: finance-only access + API-negative + mobile smoke", async ({ browser, baseURL }) => {
    // Finance: can open detail and sees Actions.
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/company-accounts/${companyAccountId}`);
      await expect(page.getByTestId("workhub-actions-button").first()).toBeVisible();
      await page.getByTestId("workhub-actions-button").first().click();
      await expect(page.getByRole("menuitem", { name: "Record Vendor Payment" }).first()).toBeVisible();
      await ctx.close();
    }

    // Restricted roles: forbidden UI.
    for (const role of ["engineer", "store", "sales", "procurement"] as const) {
      const ctx = await browser.newContext({ baseURL, storageState: states[role] });
      const page = await ctx.newPage();
      await page.goto(`/company-accounts/${companyAccountId}`);
      await expect(page.getByRole("main").getByText("You do not have access to this page.").first()).toBeVisible();
      await ctx.close();
    }

    // API-negative: restricted role gets 403 on detail endpoint.
    {
      const api = await request.newContext({ baseURL, storageState: states.engineer });
      const res = await api.get(`/api/company-accounts/${companyAccountId}/detail`);
      expect(res.status()).toBe(403);
      await api.dispose();
    }

    // Mobile smoke: actions menu opens and tabs dropdown exists.
    {
      const ctx = await browser.newContext({ ...devices["iPhone 13"], baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto(`/company-accounts/${companyAccountId}`);
      await page.getByTestId("workhub-actions-button").first().click();
      await expect(page.getByRole("menuitem", { name: "Add Account Note" }).first()).toBeVisible();
      await expect(page.getByText("Section")).toBeVisible();
      await ctx.close();
    }
  });

  test("Project financials: finance-only page + API access", async ({ browser, baseURL }) => {
    // Finance: page + KPI cards visible.
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.finance });
      const page = await ctx.newPage();
      await page.goto("/projects/financial");
      await expect(page.getByRole("heading", { name: "Project Financial Dashboard" })).toBeVisible();
      await expect(page.getByText("Total Contract Value").first()).toBeVisible();
      await expect(page.getByText("Gross Margin").first()).toBeVisible();
      await ctx.close();
    }

    // Restricted roles: forbidden UI on page.
    for (const role of ["engineer", "sales", "store", "procurement"] as const) {
      const ctx = await browser.newContext({ baseURL, storageState: states[role] });
      const page = await ctx.newPage();
      await page.goto("/projects/financial");
      await expect(page.getByText("You do not have access to project financials.").first()).toBeVisible();
      await ctx.close();
    }

    // API-negative: restricted roles cannot fetch project financial dataset.
    for (const role of ["engineer", "sales", "store", "procurement"] as const) {
      const api = await request.newContext({ baseURL, storageState: states[role] });
      const res = await api.get("/api/projects/financial");
      expect(res.status()).toBe(403);
      await api.dispose();
    }
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
      await page.getByTestId("workhub-actions-button").first().click();
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
      await page.getByTestId("workhub-actions-button").first().click();
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
      await page.getByTestId("workhub-actions-button").first().click();
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
      await page.getByTestId("workhub-actions-button").first().click();
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
      await page.getByTestId("workhub-actions-button").first().click();
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
      await page.getByTestId("workhub-actions-button").first().click();
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
      const denyText = page.getByText("You do not have access to employee details.").first();
      if (await denyText.count()) {
        await expect(denyText).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      }
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
      await page.getByTestId("workhub-actions-button").first().click();
      await expect(page.getByText("Start Purchase Order with this Item")).toBeVisible();
      await ctx.close();
    }

    // Store
    {
      const ctx = await browser.newContext({ baseURL, storageState: states.store });
      const page = await ctx.newPage();
      await page.goto(`/inventory/items/${itemDbId}`);
      await page.getByTestId("workhub-actions-button").first().click();
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
    await page.getByTestId("workhub-actions-button").first().click();
    await expect(page.getByText("Add Project Note")).toBeVisible();

    // Mobile list -> detail should show a loader indicator (cheap assertion).
    await page.goto("/vendors");
    await page.getByRole("link", { name: vendorName }).click();
    await expect(page.getByTestId("route-loading-indicator").or(page.getByTestId("app-loading-skeleton"))).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/vendors/${vendorDbId}`), { timeout: 15_000 });
    await page.getByTestId("workhub-actions-button").first().click();
    await expect(page.getByText("Add Vendor Note")).toBeVisible();

    await page.goto(`/inventory/items/${itemDbId}`);
    await page.getByTestId("workhub-actions-button").first().click();
    await expect(page.getByText("Add Item Note")).toBeVisible();

    await ctx.close();
  });
});
