import { test, expect, request } from "@playwright/test";

async function e2eLogin(page: import("@playwright/test").Page) {
  const email = process.env.E2E_TEST_EMAIL || "e2e-admin@automatrix.local";
  const password = process.env.E2E_TEST_PASSWORD || "e2e";

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: "E2E Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("RB4 - Expenses are non-stock (Phase 1)", () => {
  test("POST /api/expenses rejects inventory payload", async ({ page, baseURL }) => {
    await e2eLogin(page);

    const storageState = await page.context().storageState();
    const api = await request.newContext({ baseURL, storageState });

    const res = await api.post("/api/expenses", {
      data: {
        date: new Date().toISOString().slice(0, 10),
        description: "E2E attempt to stock-in via expenses",
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

    expect(res.status()).toBe(400);
    const payload = await res.json().catch(() => ({}));
    expect(String(payload?.error || "")).toMatch(/Stock purchases are not allowed in Expenses/i);

    await api.dispose();
  });
});

