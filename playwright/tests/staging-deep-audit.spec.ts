import { test, expect, request } from "@playwright/test";

const USERS = {
  finance: { email: "finance1@automatrix.pk", password: "e2e" },
  engineer: { email: "engineer1@automatrix.pk", password: "e2e" },
  store: { email: "store1@automatrix.pk", password: "e2e" },
};

const states = {
  finance: "playwright/.auth/staging-finance.json",
  engineer: "playwright/.auth/staging-engineer.json",
  store: "playwright/.auth/staging-store.json",
};

async function loginByEmail(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "networkidle" });
  const credentialsPanel = page.locator("div").filter({ hasText: "Email login (staging/internal)" }).first();
  const emailInput = credentialsPanel.getByPlaceholder("Email").first();
  const passInput = credentialsPanel.getByPlaceholder("Password").first();
  await expect(emailInput).toBeVisible();
  await expect(passInput).toBeVisible();
  await emailInput.fill(email);
  await passInput.fill(password);
  const submit = credentialsPanel.getByRole("button", { name: "Sign in with Email" }).first();
  await expect(credentialsPanel).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function bootstrapState(
  browser: import("@playwright/test").Browser,
  baseURL: string | undefined,
  email: string,
  password: string,
  storagePath: string,
) {
  const ctx = await browser.newContext({ baseURL, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await loginByEmail(page, email, password);
  await ctx.storageState({ path: storagePath });
  await ctx.close();
}

test.describe("Staging Deep Audit", () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    await bootstrapState(browser, baseURL, USERS.finance.email, USERS.finance.password, states.finance);
    await bootstrapState(browser, baseURL, USERS.engineer.email, USERS.engineer.password, states.engineer);
    await bootstrapState(browser, baseURL, USERS.store.email, USERS.store.password, states.store);
  });

  test("Finance UX smoke across completed modules (layout + runtime errors)", async ({
    browser,
    baseURL,
  }) => {
    const ctx = await browser.newContext({ baseURL, storageState: states.finance, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();

    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    page.on("pageerror", (e) => {
      consoleErrors.push(`PAGEERROR:${e.message}`);
    });

    const routes = [
      "/dashboard",
      "/settings",
      "/master-data",
      "/expenses",
      "/approvals",
      "/audit",
      "/reports",
      "/reports/controls",
      "/inventory",
      "/inventory/ledger",
      "/projects",
      "/procurement/purchase-orders",
      "/procurement/grn",
      "/procurement/vendor-bills",
      "/procurement/vendor-payments",
      "/employees",
      "/hrms/attendance",
      "/hrms/leave",
      "/payroll",
      "/accounting/journals",
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: "networkidle" });
      expect.soft(page.url(), `redirected unexpectedly at ${route}`).not.toContain("/login");
      const body = await page.locator("body").innerText();
      expect.soft(body, `error text on ${route}`).not.toMatch(/Error loading|Internal server error/i);
      await expect.soft(page.locator("main")).toBeVisible();
      // layout sanity: no giant horizontal overflow on main shell
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
      expect.soft(overflowX, `horizontal overflow on ${route}`).toBeFalsy();
    }

    const severe = consoleErrors.filter(
      (e) =>
        !/Failed to load resource: the server responded with a status of 401/i.test(e) &&
        !/favicon/i.test(e),
    );
    expect.soft(severe, `severe console/page errors:\n${severe.join("\n")}`).toHaveLength(0);
    await ctx.close();
  });

  test("RBAC spot checks for completed modules", async ({ browser, baseURL }) => {
    const financeCtx = await browser.newContext({ baseURL, storageState: states.finance, ignoreHTTPSErrors: true });
    const financePage = await financeCtx.newPage();
    await financePage.goto("/employees", { waitUntil: "networkidle" });
    await expect(financePage.getByRole("heading", { name: /employees/i })).toBeVisible();

    const empApi = await request.newContext({ baseURL, storageState: states.finance, ignoreHTTPSErrors: true });
    const empRes = await empApi.get("/api/employees");
    expect(empRes.ok()).toBeTruthy();
    const empJson = await empRes.json();
    const employeeId = empJson?.data?.[0]?.id;
    expect(employeeId).toBeTruthy();
    await empApi.dispose();
    await financeCtx.close();

    const storeCtx = await browser.newContext({ baseURL, storageState: states.store, ignoreHTTPSErrors: true });
    const storePage = await storeCtx.newPage();
    await storePage.goto("/audit", { waitUntil: "networkidle" });
    await expect(storePage.locator("body")).toContainText(/do not have access|forbidden|access denied/i);
    await storePage.goto(`/employees/${employeeId}`, { waitUntil: "networkidle" });
    await expect(storePage.locator("body")).toContainText(/do not have access|forbidden|access denied/i);
    await storeCtx.close();
  });

  test("Cross-module entry effect: Expense (own-pocket) -> Approval -> Reimbursement Paid -> Journal", async ({ baseURL }) => {
    const financeApi = await request.newContext({ baseURL, storageState: states.finance, ignoreHTTPSErrors: true });
    const submitterApi = await request.newContext({ baseURL, storageState: states.store, ignoreHTTPSErrors: true });

    // Ensure submitter is assigned to at least one project.
    const [usersRes, projectsRes] = await Promise.all([financeApi.get("/api/users/list"), financeApi.get("/api/projects")]);
    expect(usersRes.ok()).toBeTruthy();
    expect(projectsRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const projectsJson = await projectsRes.json();
    const submitter = (usersJson.data || []).find((u: { email?: string }) =>
      String(u.email || "").toLowerCase() === USERS.store.email,
    );
    const project = projectsJson?.data?.[0];
    expect(submitter?.id).toBeTruthy();
    expect(project?.id).toBeTruthy();

    await financeApi.post(`/api/projects/${project.id}/assignments`, {
      data: { assignments: [{ userId: submitter.id, role: "MEMBER" }] },
    });

    const [categoriesRes, settingsRes] = await Promise.all([
      submitterApi.get("/api/categories?type=expense"),
      submitterApi.get("/api/settings/organization"),
    ]);
    expect(categoriesRes.ok()).toBeTruthy();
    expect(settingsRes.ok()).toBeTruthy();
    const categoriesJson = await categoriesRes.json();
    const settingsJson = await settingsRes.json();
    const category = categoriesJson?.categories?.[0]?.name || "General";
    const threshold = Number(settingsJson?.data?.expenseReceiptThreshold || 0);
    const amount = Math.max(100, threshold + 1);
    const unique = Date.now();
    const description = `STAGING_AUDIT_EXPENSE_${unique}`;

    const createExpense = await submitterApi.post("/api/expenses", {
      data: {
        date: new Date().toISOString().slice(0, 10),
        description,
        category,
        amount,
        paymentMode: "Cash",
        paymentSource: "EMPLOYEE_POCKET",
        project: project.id,
        receiptUrl: "https://example.com/staging-audit-receipt.pdf",
        remarks: "staging deep audit",
        ignoreDuplicate: true,
      },
    });
    expect(createExpense.ok()).toBeTruthy();
    const createJson = await createExpense.json();
    const expenseId = createJson?.data?.id;
    expect(expenseId).toBeTruthy();

    const pendingRes = await financeApi.get("/api/approvals");
    expect(pendingRes.ok()).toBeTruthy();
    const pendingJson = await pendingRes.json();
    const pendingExpense = (pendingJson?.data?.expenses || []).find((e: { id?: string }) => e.id === expenseId);
    expect(pendingExpense?.id).toBe(expenseId);

    const approveRes = await financeApi.post("/api/approvals", {
      data: { expenseId, action: "APPROVE", approvedAmount: amount },
    });
    expect(approveRes.ok()).toBeTruthy();

    // Own-pocket expense stays payable until reimbursement settlement.
    const approvedExpenseRes = await financeApi.get(`/api/expenses?search=${encodeURIComponent(description)}&limit=50`);
    expect(approvedExpenseRes.ok()).toBeTruthy();
    const approvedExpenseJson = await approvedExpenseRes.json();
    const approvedExpense = (approvedExpenseJson?.data?.expenses || []).find((e: { id?: string }) => e.id === expenseId);
    expect(approvedExpense?.status).toBe("APPROVED");

    const markPaidRes = await financeApi.put(`/api/expenses/${expenseId}/mark-as-paid`);
    expect(markPaidRes.ok()).toBeTruthy();

    const journalsRes = await financeApi.get(`/api/accounting/journals?search=${expenseId}`);
    expect(journalsRes.ok()).toBeTruthy();
    const journalsJson = await journalsRes.json();
    expect((journalsJson?.data || []).length).toBeGreaterThan(0);

    await submitterApi.dispose();
    await financeApi.dispose();
  });
});
