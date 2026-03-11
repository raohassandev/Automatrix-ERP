import { test, expect, request } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const USERS = {
  finance: {
    email: process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk",
    password: process.env.E2E_FINANCE_PASSWORD || process.env.E2E_TEST_PASSWORD || "e2e",
  },
  engineer: {
    email: process.env.E2E_ENGINEER_EMAIL || "engineer1@automatrix.pk",
    password: process.env.E2E_ENGINEER_PASSWORD || process.env.E2E_TEST_PASSWORD || "e2e",
  },
  store: {
    email: process.env.E2E_STORE_EMAIL || "store1@automatrix.pk",
    password: process.env.E2E_STORE_PASSWORD || process.env.E2E_TEST_PASSWORD || "e2e",
  },
};

const states = {
  finance: "playwright/.auth/staging-finance.json",
  engineer: "playwright/.auth/staging-engineer.json",
  store: "playwright/.auth/staging-store.json",
};

function parseCsv(content: string) {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows = lines.map((line) => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        fields.push(current);
        current = "";
        continue;
      }
      current += ch;
    }
    fields.push(current);
    return fields;
  });
  const [header, ...data] = rows;
  return { header, data };
}

async function ensureNoAvailableAdvance(
  financeApi: import("@playwright/test").APIRequestContext,
  employeeId: string,
  referencePrefix: string,
) {
  const employeesRes = await financeApi.get("/api/employees");
  expect(employeesRes.ok()).toBeTruthy();
  const employeesJson = await employeesRes.json();
  const employee = (employeesJson?.data || []).find((row: { id?: string }) => row.id === employeeId);
  expect(employee?.id).toBeTruthy();

  const available = Number(employee?.walletBalance || 0) - Number(employee?.walletHold || 0);
  if (available <= 0.01) return;

  const debitAmount = Number(available.toFixed(2));
  const debitRes = await financeApi.post("/api/employees/wallet", {
    data: {
      employeeId,
      type: "DEBIT",
      amount: debitAmount,
      reference: `${referencePrefix}_${Date.now()}`,
      purpose: "COMPANY_ADVANCE",
    },
  });
  if (!debitRes.ok()) {
    const body = await debitRes.text();
    throw new Error(`Failed to clear available advance before own-pocket flow: ${debitRes.status()} ${body}`);
  }
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
  await loginAs(page, email, password);
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

    const gotoStable = async (route: string) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await page.goto(route, { waitUntil: "domcontentloaded", timeout: 30_000 });
          await page.waitForTimeout(250);
          return;
        } catch {
          if (attempt === 2) throw new Error(`Could not load route: ${route}`);
          await page.waitForTimeout(1000 * (attempt + 1));
        }
      }
    };

    for (const route of routes) {
      await gotoStable(route);
      let body = await page.locator("body").innerText();
      // Staging can briefly return 502 during deployment restarts; retry once.
      if (/502 Bad Gateway/i.test(body)) {
        await page.waitForTimeout(1200);
        await gotoStable(route);
        body = await page.locator("body").innerText();
      }
      expect.soft(page.url(), `redirected unexpectedly at ${route}`).not.toContain("/login");
      expect.soft(body, `error text on ${route}`).not.toMatch(/Error loading|Internal server error/i);
      await expect.soft(page.locator("main")).toBeVisible();
      // layout sanity: no giant horizontal overflow on main shell
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
      expect.soft(overflowX, `horizontal overflow on ${route}`).toBeFalsy();
    }

    const severe = consoleErrors.filter(
      (e) =>
        !/502 \(Bad Gateway\)/i.test(e) &&
        !/TypeError:\s*Failed to fetch/i.test(e) &&
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
    const [usersRes, projectsRes, employeesRes] = await Promise.all([
      financeApi.get("/api/users/list"),
      financeApi.get("/api/projects"),
      financeApi.get("/api/employees"),
    ]);
    expect(usersRes.ok()).toBeTruthy();
    expect(projectsRes.ok()).toBeTruthy();
    expect(employeesRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const projectsJson = await projectsRes.json();
    const employeesJson = await employeesRes.json();
    const submitter = (usersJson.data || []).find((u: { email?: string }) =>
      String(u.email || "").toLowerCase() === USERS.store.email,
    );
    const submitterEmployee = (employeesJson.data || []).find((e: { email?: string }) =>
      String(e.email || "").toLowerCase() === USERS.store.email,
    );
    const project = projectsJson?.data?.[0];
    expect(submitter?.id).toBeTruthy();
    expect(submitterEmployee?.id).toBeTruthy();
    expect(project?.id).toBeTruthy();

    await financeApi.post(`/api/projects/${project.id}/assignments`, {
      data: { assignments: [{ userId: submitter.id, role: "MEMBER" }] },
    });
    await ensureNoAvailableAdvance(financeApi, submitterEmployee.id, "STAGING_CLEAR_ADV_OWN_POCKET");

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

  test("Mistaken approval reopen: permission-gated and resets own-pocket expense to pending", async ({ baseURL }) => {
    const financeApi = await request.newContext({ baseURL, storageState: states.finance, ignoreHTTPSErrors: true });
    const submitterApi = await request.newContext({ baseURL, storageState: states.store, ignoreHTTPSErrors: true });

    const [usersRes, projectsRes, employeesRes] = await Promise.all([
      financeApi.get("/api/users/list"),
      financeApi.get("/api/projects"),
      financeApi.get("/api/employees"),
    ]);
    expect(usersRes.ok()).toBeTruthy();
    expect(projectsRes.ok()).toBeTruthy();
    expect(employeesRes.ok()).toBeTruthy();
    const usersJson = await usersRes.json();
    const projectsJson = await projectsRes.json();
    const employeesJson = await employeesRes.json();
    const financeUser = (usersJson.data || []).find((u: { email?: string }) =>
      String(u.email || "").toLowerCase() === USERS.finance.email,
    );
    const submitter = (usersJson.data || []).find((u: { email?: string }) =>
      String(u.email || "").toLowerCase() === USERS.store.email,
    );
    const submitterEmployee = (employeesJson.data || []).find((e: { email?: string }) =>
      String(e.email || "").toLowerCase() === USERS.store.email,
    );
    const project = projectsJson?.data?.[0];
    expect(financeUser?.id).toBeTruthy();
    expect(submitter?.id).toBeTruthy();
    expect(submitterEmployee?.id).toBeTruthy();
    expect(project?.id).toBeTruthy();

    const overridesRes = await financeApi.get(`/api/access-control/user-overrides?userId=${financeUser.id}`);
    expect(overridesRes.ok()).toBeTruthy();
    const overridesJson = await overridesRes.json();
    const originalOverrides = Array.isArray(overridesJson?.selectedUser?.overrides)
      ? overridesJson.selectedUser.overrides
      : [];
    const hasReopenOverride = originalOverrides.some(
      (row: { permissionKey?: string; effect?: string }) =>
        row.permissionKey === "expenses.reopen_approved" && row.effect === "ALLOW",
    );
    const workingOverrides = hasReopenOverride
      ? originalOverrides
      : [...originalOverrides, { permissionKey: "expenses.reopen_approved", effect: "ALLOW", reason: "staging audit temporary allow" }];
    const grantRes = await financeApi.put("/api/access-control/user-overrides", {
      data: {
        userId: financeUser.id,
        overrides: workingOverrides,
      },
    });
    expect(grantRes.ok()).toBeTruthy();

    try {
      await financeApi.post(`/api/projects/${project.id}/assignments`, {
        data: { assignments: [{ userId: submitter.id, role: "MEMBER" }] },
      });
      await ensureNoAvailableAdvance(financeApi, submitterEmployee.id, "STAGING_CLEAR_ADV_REOPEN");

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
      const amount = Math.max(120, threshold + 1);
      const unique = Date.now();
      const description = `STAGING_AUDIT_REOPEN_${unique}`;

      const createExpense = await submitterApi.post("/api/expenses", {
        data: {
          date: new Date().toISOString().slice(0, 10),
          description,
          category,
          amount,
          paymentMode: "Cash",
          paymentSource: "EMPLOYEE_POCKET",
          project: project.id,
          receiptUrl: "https://example.com/staging-audit-reopen-receipt.pdf",
          remarks: "staging reopen control audit",
          ignoreDuplicate: true,
        },
      });
      expect(createExpense.ok()).toBeTruthy();
      const createJson = await createExpense.json();
      const expenseId = createJson?.data?.id;
      expect(expenseId).toBeTruthy();

      const approveRes = await financeApi.post("/api/approvals", {
        data: { expenseId, action: "APPROVE", approvedAmount: amount },
      });
      expect(approveRes.ok()).toBeTruthy();

      const submitterReopenRes = await submitterApi.put(`/api/expenses/${expenseId}/reopen`);
      expect(submitterReopenRes.status()).toBe(403);

      const financeReopenRes = await financeApi.put(`/api/expenses/${expenseId}/reopen`);
      expect(financeReopenRes.ok()).toBeTruthy();

      const checkRes = await financeApi.get(`/api/expenses?search=${encodeURIComponent(description)}&limit=50`);
      expect(checkRes.ok()).toBeTruthy();
      const checkJson = await checkRes.json();
      const reopened = (checkJson?.data?.expenses || []).find((e: { id?: string }) => e.id === expenseId);
      expect(String(reopened?.status || "")).toMatch(/^PENDING_/);
    } finally {
      await financeApi.put("/api/access-control/user-overrides", {
        data: {
          userId: financeUser.id,
          overrides: originalOverrides,
        },
      });
    }

    await submitterApi.dispose();
    await financeApi.dispose();
  });

  test("Advance-funded controls: own-pocket blocked when advance exists and wallet expense cannot be paid twice", async ({ baseURL }) => {
    const financeApi = await request.newContext({ baseURL, storageState: states.finance, ignoreHTTPSErrors: true });
    const submitterApi = await request.newContext({ baseURL, storageState: states.store, ignoreHTTPSErrors: true });

    const [usersRes, projectsRes, employeesRes, companyAccountsRes, categoriesRes, settingsRes] = await Promise.all([
      financeApi.get("/api/users/list"),
      financeApi.get("/api/projects"),
      financeApi.get("/api/employees"),
      financeApi.get("/api/company-accounts"),
      submitterApi.get("/api/categories?type=expense"),
      submitterApi.get("/api/settings/organization"),
    ]);
    expect(usersRes.ok()).toBeTruthy();
    expect(projectsRes.ok()).toBeTruthy();
    expect(employeesRes.ok()).toBeTruthy();
    expect(companyAccountsRes.ok()).toBeTruthy();
    expect(categoriesRes.ok()).toBeTruthy();
    expect(settingsRes.ok()).toBeTruthy();

    const usersJson = await usersRes.json();
    const projectsJson = await projectsRes.json();
    const employeesJson = await employeesRes.json();
    const companyAccountsJson = await companyAccountsRes.json();
    const categoriesJson = await categoriesRes.json();
    const settingsJson = await settingsRes.json();

    const submitterUser = (usersJson.data || []).find((u: { email?: string }) =>
      String(u.email || "").toLowerCase() === USERS.store.email,
    );
    const submitterEmployee = (employeesJson.data || []).find((e: { email?: string }) =>
      String(e.email || "").toLowerCase() === USERS.store.email,
    );
    const project = projectsJson?.data?.[0];
    const companyAccount = (companyAccountsJson?.data || []).find((a: { isActive?: boolean }) => a.isActive !== false);
    expect(submitterUser?.id).toBeTruthy();
    expect(submitterEmployee?.id).toBeTruthy();
    expect(project?.id).toBeTruthy();
    expect(companyAccount?.id).toBeTruthy();

    const originalBalance = Number(submitterEmployee?.walletBalance || 0);
    const category = categoriesJson?.categories?.[0]?.name || "General";
    const threshold = Number(settingsJson?.data?.expenseReceiptThreshold || 0);
    const amount = Math.max(150, threshold + 1);
    const unique = Date.now();

    await financeApi.post(`/api/projects/${project.id}/assignments`, {
      data: { assignments: [{ userId: submitterUser.id, role: "MEMBER" }] },
    });

    const topupReference = `STAGING_AUDIT_ADV_${unique}`;
    const topupRes = await financeApi.post("/api/employees/wallet", {
      data: {
        employeeId: submitterEmployee.id,
        type: "CREDIT",
        amount: amount + 200,
        reference: topupReference,
        companyAccountId: companyAccount.id,
        purpose: "COMPANY_ADVANCE",
      },
    });
    expect(topupRes.ok()).toBeTruthy();

    try {
      const blockedOwnPocketRes = await submitterApi.post("/api/expenses", {
        data: {
          date: new Date().toISOString().slice(0, 10),
          description: `STAGING_AUDIT_ADV_BLOCK_${unique}`,
          category,
          amount,
          paymentMode: "Cash",
          paymentSource: "EMPLOYEE_POCKET",
          project: project.id,
          receiptUrl: "https://example.com/staging-audit-advance-block.pdf",
          remarks: "advance guard check",
          ignoreDuplicate: true,
        },
      });
      expect(blockedOwnPocketRes.status()).toBe(400);
      const blockedOwnPocketJson = await blockedOwnPocketRes.json();
      expect(String(blockedOwnPocketJson?.error || "")).toMatch(/advance available|employee wallet/i);

      const walletExpenseRes = await submitterApi.post("/api/expenses", {
        data: {
          date: new Date().toISOString().slice(0, 10),
          description: `STAGING_AUDIT_WALLET_EXP_${unique}`,
          category,
          amount,
          paymentMode: "Cash",
          paymentSource: "EMPLOYEE_WALLET",
          project: project.id,
          receiptUrl: "https://example.com/staging-audit-wallet-expense.pdf",
          remarks: "wallet settlement control check",
          ignoreDuplicate: true,
        },
      });
      expect(walletExpenseRes.ok()).toBeTruthy();
      const walletExpenseJson = await walletExpenseRes.json();
      const walletExpenseId = walletExpenseJson?.data?.id;
      expect(walletExpenseId).toBeTruthy();

      const approveWalletExpenseRes = await financeApi.post("/api/approvals", {
        data: { expenseId: walletExpenseId, action: "APPROVE", approvedAmount: amount },
      });
      expect(approveWalletExpenseRes.ok()).toBeTruthy();

      const markPaidWalletRes = await financeApi.put(`/api/expenses/${walletExpenseId}/mark-as-paid`);
      expect(markPaidWalletRes.status()).toBe(400);
      const markPaidWalletJson = await markPaidWalletRes.json();
      expect(String(markPaidWalletJson?.error || "")).toMatch(/already settled|cannot mark as paid/i);
    } finally {
      const employeesAfterRes = await financeApi.get("/api/employees");
      if (employeesAfterRes.ok()) {
        const employeesAfterJson = await employeesAfterRes.json();
        const submitterAfter = (employeesAfterJson.data || []).find((e: { email?: string }) =>
          String(e.email || "").toLowerCase() === USERS.store.email,
        );
        const currentBalance = Number(submitterAfter?.walletBalance || 0);
        const delta = currentBalance - originalBalance;
        if (Math.abs(delta) >= 1) {
          const restoreType = delta > 0 ? "DEBIT" : "CREDIT";
          const restoreAmount = Math.abs(delta);
          await financeApi.post("/api/employees/wallet", {
            data: {
              employeeId: submitterEmployee.id,
              type: restoreType,
              amount: restoreAmount,
              reference: `STAGING_AUDIT_RESTORE_${unique}`,
              ...(restoreType === "CREDIT" ? { companyAccountId: companyAccount.id } : {}),
              purpose: "ADJUSTMENT",
            },
          });
        }
      }
    }

    await submitterApi.dispose();
    await financeApi.dispose();
  });

  test("Cross-module reconciliation: project income/cost, AP outstanding, and export consistency", async ({ baseURL }) => {
    const financeApi = await request.newContext({ baseURL, storageState: states.finance, ignoreHTTPSErrors: true });
    const submitterApi = await request.newContext({ baseURL, storageState: states.store, ignoreHTTPSErrors: true });
    const unique = Date.now();

    const [usersRes, employeesRes, categoriesRes, accountsRes] = await Promise.all([
      financeApi.get("/api/users/list"),
      financeApi.get("/api/employees"),
      submitterApi.get("/api/categories?type=expense"),
      financeApi.get("/api/company-accounts"),
    ]);
    expect(usersRes.ok()).toBeTruthy();
    expect(employeesRes.ok()).toBeTruthy();
    expect(categoriesRes.ok()).toBeTruthy();
    expect(accountsRes.ok()).toBeTruthy();

    const usersJson = await usersRes.json();
    const employeesJson = await employeesRes.json();
    const categoriesJson = await categoriesRes.json();
    const accountsJson = await accountsRes.json();

    const storeUser = (usersJson.data || []).find((u: { email?: string }) =>
      String(u.email || "").toLowerCase() === USERS.store.email,
    );
    const storeEmployee = (employeesJson.data || []).find((e: { email?: string }) =>
      String(e.email || "").toLowerCase() === USERS.store.email,
    );
    expect(storeUser?.id).toBeTruthy();
    expect(storeEmployee?.id).toBeTruthy();
    await ensureNoAvailableAdvance(financeApi, storeEmployee.id, "STAGING_CLEAR_ADV_RECON");

    const account = (accountsJson.data || []).find((row: { isActive?: boolean }) => row.isActive !== false);
    expect(account?.id).toBeTruthy();

    const clientRes = await financeApi.post("/api/clients", {
      data: { name: `STAGING_REC_CLIENT_${unique}` },
    });
    expect(clientRes.ok()).toBeTruthy();
    const clientId = (await clientRes.json())?.data?.id;
    expect(clientId).toBeTruthy();

    const contractValue = 20_000;
    const createProjectRes = await financeApi.post("/api/projects", {
      data: {
        projectId: `STAGING-REC-${unique}`,
        name: `STAGING_REC_PROJECT_${unique}`,
        clientId,
        startDate: new Date().toISOString().slice(0, 10),
        status: "ACTIVE",
        contractValue,
      },
    });
    expect(createProjectRes.ok()).toBeTruthy();
    const project = (await createProjectRes.json())?.data;
    expect(project?.id).toBeTruthy();

    await financeApi.post(`/api/projects/${project.id}/assignments`, {
      data: { assignments: [{ userId: storeUser.id, role: "MEMBER" }] },
    });

    const incomeAmount = 10_000;
    const createIncomeRes = await financeApi.post("/api/income", {
      data: {
        date: new Date().toISOString().slice(0, 10),
        source: `Project Payment ${unique}`,
        category: "Project Payment",
        amount: incomeAmount,
        paymentMode: "Bank",
        companyAccountId: account.id,
        project: project.id,
        remarks: "staging reconciliation income",
      },
    });
    expect(createIncomeRes.ok()).toBeTruthy();

    const createVendorRes = await financeApi.post("/api/vendors", {
      data: {
        name: `STAGING_REC_VENDOR_${unique}`,
        contactName: "Reconciliation Vendor",
        phone: "03001234567",
        email: `staging-rec-${unique}@example.com`,
        status: "ACTIVE",
      },
    });
    expect(createVendorRes.ok()).toBeTruthy();
    const vendorId = (await createVendorRes.json())?.data?.id;
    expect(vendorId).toBeTruthy();

    const billAmount = 3_000;
    const createBillRes = await financeApi.post("/api/procurement/vendor-bills", {
      data: {
        billNumber: `BILL-REC-${unique}`,
        vendorId,
        projectRef: project.id,
        billDate: new Date().toISOString().slice(0, 10),
        currency: "PKR",
        lines: [
          {
            description: "Reconciliation test service line",
            total: billAmount,
          },
        ],
      },
    });
    expect(createBillRes.ok()).toBeTruthy();
    const bill = (await createBillRes.json())?.data;
    expect(bill?.id).toBeTruthy();

    for (const action of ["SUBMIT", "APPROVE", "POST"] as const) {
      const stepRes = await financeApi.patch(`/api/procurement/vendor-bills/${bill.id}`, {
        data: { action },
      });
      expect(stepRes.ok()).toBeTruthy();
    }

    const paymentAmount = 1_200;
    const createPaymentRes = await financeApi.post("/api/procurement/vendor-payments", {
      data: {
        paymentNumber: `PAY-REC-${unique}`,
        vendorId,
        projectRef: project.id,
        paymentDate: new Date().toISOString().slice(0, 10),
        companyAccountId: account.id,
        method: "Bank Transfer",
        amount: paymentAmount,
        allocations: [{ vendorBillId: bill.id, amount: paymentAmount }],
      },
    });
    expect(createPaymentRes.ok()).toBeTruthy();
    const payment = (await createPaymentRes.json())?.data;
    expect(payment?.id).toBeTruthy();

    for (const action of ["SUBMIT", "APPROVE", "POST"] as const) {
      const stepRes = await financeApi.patch(`/api/procurement/vendor-payments/${payment.id}`, {
        data: { action },
      });
      expect(stepRes.ok()).toBeTruthy();
    }

    const category = categoriesJson?.categories?.[0]?.name || "General";
    const expenseAmount = 500;
    const createExpenseRes = await submitterApi.post("/api/expenses", {
      data: {
        date: new Date().toISOString().slice(0, 10),
        description: `STAGING_REC_EXP_${unique}`,
        category,
        amount: expenseAmount,
        paymentMode: "Cash",
        paymentSource: "EMPLOYEE_POCKET",
        project: project.id,
        receiptUrl: "https://example.com/staging-rec-expense.pdf",
        remarks: "staging reconciliation expense",
        ignoreDuplicate: true,
      },
    });
    expect(createExpenseRes.ok()).toBeTruthy();
    const expenseId = (await createExpenseRes.json())?.data?.id;
    expect(expenseId).toBeTruthy();

    const approveExpenseRes = await financeApi.post("/api/approvals", {
      data: { expenseId, action: "APPROVE", approvedAmount: expenseAmount },
    });
    expect(approveExpenseRes.ok()).toBeTruthy();

    const payExpenseRes = await financeApi.put(`/api/expenses/${expenseId}/mark-as-paid`);
    expect(payExpenseRes.ok()).toBeTruthy();

    const projectDetailRes = await financeApi.get(`/api/projects/${project.id}/detail`);
    expect(projectDetailRes.ok()).toBeTruthy();
    const projectDetail = (await projectDetailRes.json())?.data;
    const costs = projectDetail?.costs;
    expect(costs).toBeTruthy();

    // Reconciliation assertions on fresh deterministic records.
    expect(Number(costs.approvedIncomeReceived)).toBeCloseTo(incomeAmount, 2);
    expect(Number(costs.apOutstanding)).toBeCloseTo(billAmount - paymentAmount, 2);
    expect(Number(costs.pendingRecovery)).toBeCloseTo(contractValue - incomeAmount, 2);
    expect(Number(costs.costToDate)).toBeCloseTo(billAmount + expenseAmount, 2);

    const listRes = await financeApi.get("/api/projects");
    expect(listRes.ok()).toBeTruthy();
    const listJson = await listRes.json();
    const listed = (listJson?.data || []).find((row: { id?: string }) => row.id === project.id);
    expect(Number(listed?.receivedAmount || 0)).toBeCloseTo(incomeAmount, 2);
    expect(Number(listed?.pendingRecovery || 0)).toBeCloseTo(contractValue - incomeAmount, 2);

    const billDetailRes = await financeApi.get(`/api/procurement/vendor-bills/${bill.id}`);
    expect(billDetailRes.ok()).toBeTruthy();
    const billDetail = (await billDetailRes.json())?.data;
    expect(Number(billDetail?.outstandingAmount || 0)).toBeCloseTo(billAmount - paymentAmount, 2);

    const apExportRes = await financeApi.get(`/api/reports/ap/export?vendor=${encodeURIComponent(`STAGING_REC_VENDOR_${unique}`)}`);
    expect(apExportRes.ok()).toBeTruthy();
    const apCsv = await apExportRes.text();
    const parsedAp = parseCsv(apCsv);
    const matchingRow = parsedAp.data.find((row) => row[0] === `BILL-REC-${unique}`);
    expect(matchingRow).toBeTruthy();
    const outstandingField = String(matchingRow?.[6] || "");
    const outstandingValue = Number(outstandingField.replace(/[^0-9.-]/g, ""));
    expect(outstandingValue).toBeCloseTo(billAmount - paymentAmount, 2);

    const employeesAfterRes = await financeApi.get("/api/employees");
    expect(employeesAfterRes.ok()).toBeTruthy();
    const employeesAfterJson = await employeesAfterRes.json();
    const storeEmployeeAfter = (employeesAfterJson?.data || []).find((row: { email?: string }) =>
      String(row.email || "").toLowerCase() === USERS.store.email,
    );
    expect(storeEmployeeAfter).toBeTruthy();

    const meWalletRes = await submitterApi.get("/api/me/wallet/export");
    expect(meWalletRes.ok()).toBeTruthy();
    const meWalletCsv = await meWalletRes.text();
    // Own-pocket expenses are reimbursed through company payment, not wallet debit.
    expect(meWalletCsv).not.toContain(expenseId);

    await submitterApi.dispose();
    await financeApi.dispose();
  });
});
