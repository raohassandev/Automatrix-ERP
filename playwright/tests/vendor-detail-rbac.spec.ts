import { test, expect, request, devices } from "@playwright/test";

const ROLE_EMAILS = {
  engineer: "engineer1@automatrix.pk",
  sales: "sales1@automatrix.pk",
  store: "store1@automatrix.pk",
  procurement: "finance1@automatrix.pk", // Finance has procurement.edit/view in this repo; keep procurement-role UI assertions separate.
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

test.describe.serial("Vendor Detail (RBAC + mobile)", () => {
  let vendorDbId = "";
  const states = {
    engineer: "playwright/.auth/engineer.json",
    sales: "playwright/.auth/sales.json",
    store: "playwright/.auth/store.json",
    finance: "playwright/.auth/finance.json",
  } as const;

  test.beforeAll(async ({ browser, baseURL }) => {
    // Create storage states (also bootstraps these users/employees in E2E mode).
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.finance, states.finance);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.engineer, states.engineer);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.sales, states.sales);
    await ensureStorageState(browser, baseURL, ROLE_EMAILS.store, states.store);

    const api = await request.newContext({ baseURL, storageState: states.finance });
    const ts = Date.now();
    const today = new Date().toISOString().slice(0, 10);

    // Create client + project (required for projectRef on bills/payments).
    const clientRes = await api.post("/api/clients", { data: { name: `E2E Vendor Client ${ts}` } });
    expect(clientRes.ok()).toBeTruthy();
    const clientJson = await clientRes.json();
    const clientId: string = clientJson.data.id;

    const projectRes = await api.post("/api/projects", {
      data: {
        projectId: `PRJ-E2E-VENDOR-${ts}`,
        name: `E2E Vendor Project ${ts}`,
        clientId,
        startDate: today,
        status: "ACTIVE",
        contractValue: 0,
      },
    });
    expect(projectRes.ok()).toBeTruthy();
    const projectJson = await projectRes.json();
    const projectDbId: string = projectJson.data.id;

    // Assign engineer to the project so scoped vendor access works for restricted roles.
    const usersRes = await api.get("/api/users/list");
    expect(usersRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const byEmail = new Map<string, string>(
      (usersJson.data || []).map((u: { email: string; id: string }) => [String(u.email).toLowerCase(), u.id]),
    );

    const assignRes = await api.post(`/api/projects/${projectDbId}/assignments`, {
      data: { assignments: [{ userId: byEmail.get(ROLE_EMAILS.engineer)!, role: "MEMBER" }] },
    });
    expect(assignRes.ok()).toBeTruthy();

    // Create vendor
    const vendorRes = await api.post("/api/vendors", {
      data: {
        name: `E2E Vendor ${ts}`,
        contactName: "E2E Contact",
        phone: "0300-0000000",
        status: "ACTIVE",
      },
    });
    expect(vendorRes.ok()).toBeTruthy();
    const vendorJson = await vendorRes.json();
    vendorDbId = vendorJson.data.id;

    // Ensure a company account exists.
    const accountsRes = await api.get("/api/company-accounts");
    expect(accountsRes.ok()).toBeTruthy();
    const accountsJson = await accountsRes.json();
    const accounts: Array<{ id: string; name: string }> = accountsJson.data || [];
    let companyAccountId = accounts[0]?.id;
    if (!companyAccountId) {
      const createAccRes = await api.post("/api/company-accounts", {
        data: { name: `E2E Cash ${ts}`, type: "CASH", currency: "PKR", openingBalance: 0 },
      });
      expect(createAccRes.ok()).toBeTruthy();
      const createAccJson = await createAccRes.json();
      companyAccountId = createAccJson.data.id;
    }

    // Create Vendor Bill
    const billNumber = `BILL-E2E-${ts}`;
    const billRes = await api.post("/api/procurement/vendor-bills", {
      data: {
        billNumber,
        vendorId: vendorDbId,
        projectRef: `PRJ-E2E-VENDOR-${ts}`,
        billDate: today,
        currency: "PKR",
        lines: [{ description: "E2E line", total: 1000 }],
      },
    });
    expect(billRes.ok()).toBeTruthy();
    const billJson = await billRes.json();
    const vendorBillId: string = billJson.data.id;

    // Create Vendor Payment with allocation
    const paymentRes = await api.post("/api/procurement/vendor-payments", {
      data: {
        paymentNumber: `PAY-E2E-${ts}`,
        vendorId: vendorDbId,
        projectRef: `PRJ-E2E-VENDOR-${ts}`,
        paymentDate: today,
        companyAccountId,
        amount: 1000,
        allocations: [{ vendorBillId, amount: 1000 }],
      },
    });
    expect(paymentRes.ok()).toBeTruthy();

    await api.dispose();
  });

  test("Finance: sees all tabs (incl Bills/Payments/Aging)", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.finance });
    const page = await ctx.newPage();
    await page.goto(`/vendors/${vendorDbId}`);
    await expect(page.getByRole("heading", { name: /E2E Vendor/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Activity")).toBeVisible();
    await expect(page.getByText("Bills")).toBeVisible();
    await expect(page.getByText("Payments")).toBeVisible();
    await expect(page.getByText("Aging")).toBeVisible();
    await expect(page.getByText("Documents")).toBeVisible();
    await ctx.close();
  });

  test("Engineer: docs/activity only; no Bills/Payments/Aging", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.engineer });
    const page = await ctx.newPage();
    await page.goto(`/vendors/${vendorDbId}`);
    await expect(page.getByText("Activity")).toBeVisible();
    await expect(page.getByText("Documents")).toBeVisible();
    await expect(page.getByText("Bills")).toHaveCount(0);
    await expect(page.getByText("Payments")).toHaveCount(0);
    await expect(page.getByText("Aging")).toHaveCount(0);
    await ctx.close();
  });

  test("Sales: docs/activity only; cannot see amount fields via API", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.sales });
    const page = await ctx.newPage();
    await page.goto(`/vendors/${vendorDbId}`);
    await expect(page.getByText("Documents")).toBeVisible();
    await expect(page.getByText("Bills")).toHaveCount(0);
    await expect(page.getByText("Payments")).toHaveCount(0);

    const api = await request.newContext({ baseURL, storageState: states.sales });
    const res = await api.get(`/api/vendors/${vendorDbId}/detail`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    const text = JSON.stringify(json);
    expect(text.includes("totalAmount")).toBeFalsy();
    expect(text.includes("allocatedAmount")).toBeFalsy();
    expect(text.includes("\"aging\"")).toBeFalsy();
    await api.dispose();
    await ctx.close();
  });

  test("Store: docs/activity only; no Bills/Payments tabs", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.store });
    const page = await ctx.newPage();
    await page.goto(`/vendors/${vendorDbId}`);
    await expect(page.getByText("Documents")).toBeVisible();
    await expect(page.getByText("Bills")).toHaveCount(0);
    await expect(page.getByText("Payments")).toHaveCount(0);
    await expect(page.getByText("Aging")).toHaveCount(0);
    await ctx.close();
  });

  test("Mobile (iPhone 13): vendors list -> detail loads; tabs dropdown works", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({
      ...devices["iPhone 13"],
      baseURL,
      storageState: states.finance,
    });
    const page = await ctx.newPage();
    await page.goto("/vendors");
    await page.getByRole("link", { name: /E2E Vendor/i }).first().click();
    await expect(page).toHaveURL(/\/vendors\/.+/);

    // Mobile uses dropdown select for tabs.
    const select = page.locator("select");
    await expect(select).toBeVisible();
    await select.selectOption({ label: "Documents" });
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await ctx.close();
  });
});

