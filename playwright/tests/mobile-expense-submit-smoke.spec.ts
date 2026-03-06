import { test, expect, devices, request } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const SUBMITTER_EMAIL = process.env.E2E_STORE_EMAIL || "store1@automatrix.pk";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "e2e";

test.use({ ...devices["iPhone 13"] });

test.describe("Mobile expense submit smoke", () => {
  test("submitter can submit and cleanup a pending expense from mobile UI", async ({ page, context, baseURL }) => {
    await loginAs(page, SUBMITTER_EMAIL, PASSWORD);

    const storageState = await context.storageState();
    const api = await request.newContext({ baseURL, storageState, ignoreHTTPSErrors: true });

    const projectsRes = await api.get("/api/projects");
    expect(projectsRes.ok()).toBeTruthy();
    const projectsJson = await projectsRes.json();
    const project = (projectsJson?.data || []).find((row: { projectId?: string }) => String(row.projectId || "").length > 0);
    expect(project?.projectId).toBeTruthy();

    const unique = Date.now();
    const description = `MOBILE_EXP_SMOKE_${unique}`;
    let createdExpenseId: string | null = null;

    try {
      await page.goto("/expenses", { waitUntil: "domcontentloaded" });
      const submitAction = page.getByRole("button", { name: /^Submit Expense$/ }).first();
      await expect(submitAction).toBeVisible();
      await submitAction.click();

      await expect(page.getByRole("heading", { name: "Submit Expense" })).toBeVisible();

      await page.locator("#date").fill(new Date().toISOString().slice(0, 10));

      const categoryField = page.locator("label[for='category']").locator("..");
      await categoryField.getByRole("combobox").click();
      await page
        .locator("[role='option']")
        .filter({ hasNotText: /Loading|No categories/i })
        .first()
        .click();

      const formComboboxes = page.locator("form [role='combobox']");
      await formComboboxes.nth(1).click();
      await page.getByRole("option", { name: /Cash/i }).first().click();

      await page.locator("#amount").fill("100");
      await page.locator("#description").fill(description);

      await formComboboxes.nth(4).click();
      await page.getByPlaceholder("Search project...").fill(project.projectId);
      await page.getByRole("option", { name: new RegExp(project.projectId, "i") }).first().click();

      await page.getByRole("button", { name: "Submit Expense" }).click();
      await expect(page.getByText("Expense submitted successfully!")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Submit Expense" })).not.toBeVisible();

      const expenseLookupRes = await api.get(`/api/expenses?search=${encodeURIComponent(description)}&limit=20`);
      expect(expenseLookupRes.ok()).toBeTruthy();
      const expenseLookupJson = await expenseLookupRes.json();
      const createdExpense = (expenseLookupJson?.data?.expenses || []).find(
        (row: { description?: string }) => row.description === description,
      );
      expect(createdExpense?.id).toBeTruthy();
      createdExpenseId = createdExpense.id;
    } finally {
      if (createdExpenseId) {
        const deleteRes = await api.delete(`/api/expenses/${createdExpenseId}`);
        expect(deleteRes.ok()).toBeTruthy();
      }
      await api.dispose();
    }
  });
});
