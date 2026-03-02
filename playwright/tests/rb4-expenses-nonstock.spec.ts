import { test, expect, request } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";
const ENGINEER_EMAIL = process.env.E2E_ENGINEER_EMAIL || "engineer1@automatrix.pk";

test.describe("RB4 - Expenses are non-stock (Phase 1)", () => {
  test("POST /api/expenses rejects stock payload for unauthorized submitter (403)", async ({
    page,
    baseURL,
  }) => {
    await loginAs(page, FINANCE_EMAIL);

    const storageState = await page.context().storageState();
    const api = await request.newContext({ baseURL, storageState, ignoreHTTPSErrors: true });

    const res = await api.post("/api/expenses", {
      data: {
        date: new Date().toISOString().slice(0, 10),
        description: `E2E unauthorized stock payload ${Date.now()}`,
        category: "Material (Stock/Inventory)",
        amount: 100,
        paymentMode: "Cash",
        expenseType: "COMPANY",
        project: "E2E Project",
        inventoryItemId: "00000000-0000-0000-0000-000000000000",
        inventoryQuantity: 1,
        inventoryUnitCost: 100,
      },
    });

    expect(res.status()).toBe(403);
    const payload = await res.json().catch(() => ({} as { error?: string }));
    expect(String(payload?.error || "")).toMatch(/permission|not allowed|forbidden/i);

    await api.dispose();
  });

  test("POST /api/expenses rejects stock payload for authorized submitter (400 policy block)", async ({
    page,
    baseURL,
  }) => {
    await loginAs(page, ENGINEER_EMAIL);

    const storageState = await page.context().storageState();
    const api = await request.newContext({ baseURL, storageState, ignoreHTTPSErrors: true });

    const res = await api.post("/api/expenses", {
      data: {
        date: new Date().toISOString().slice(0, 10),
        description: `E2E policy stock payload ${Date.now()}`,
        category: "Material (Stock/Inventory)",
        amount: 100,
        paymentMode: "Cash",
        expenseType: "COMPANY",
        project: "General Office",
        inventoryItemId: "00000000-0000-0000-0000-000000000000",
        inventoryQuantity: 1,
        inventoryUnitCost: 100,
      },
    });

    expect(res.status()).toBe(400);
    const payload = await res.json().catch(() => ({} as { error?: string }));
    expect(String(payload?.error || "")).toMatch(/Stock purchases are not allowed in Expenses/i);

    await api.dispose();
  });
});
