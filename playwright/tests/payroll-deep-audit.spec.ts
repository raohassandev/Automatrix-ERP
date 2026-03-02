import { expect, request, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";
const ENGINEER_EMAIL = process.env.E2E_ENGINEER_EMAIL || "engineer1@automatrix.pk";

function previousMonthRange() {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

test.describe("Payroll deep audit", () => {
  test("salary advance lock rules and payroll policy signal", async ({ page, baseURL }) => {
    await loginAs(page, FINANCE_EMAIL);
    const storageState = await page.context().storageState();
    const api = await request.newContext({ baseURL, storageState, ignoreHTTPSErrors: true });

    const employeesRes = await api.get("/api/employees");
    expect(employeesRes.ok()).toBeTruthy();
    const employeesJson = await employeesRes.json();
    const employees: Array<{ id: string; email?: string | null }> = employeesJson.data || [];
    const engineer = employees.find((row) => (row.email || "").toLowerCase() === ENGINEER_EMAIL.toLowerCase());
    expect(engineer).toBeTruthy();

    const amount = 777;
    const createRes = await api.post("/api/salary-advances", {
      data: {
        employeeId: engineer!.id,
        amount,
        reason: `E2E payroll advance lock ${Date.now()}`,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const createJson = await createRes.json();
    const advanceId: string = createJson.data.id;

    const approveRes = await api.patch(`/api/salary-advances/${advanceId}`, {
      data: { status: "APPROVED" },
    });
    expect(approveRes.ok()).toBeTruthy();
    const approveJson = await approveRes.json();
    expect(approveJson.data.status).toBe("PAID");
    expect(Boolean(approveJson.data.walletLedgerId)).toBeTruthy();

    const editBlockedRes = await api.patch(`/api/salary-advances/${advanceId}`, {
      data: { reason: "tamper attempt" },
    });
    expect(editBlockedRes.status()).toBe(400);
    const editBlockedJson = await editBlockedRes.json();
    expect(String(editBlockedJson.error || "")).toMatch(/locked|cannot be edited/i);

    const deleteBlockedRes = await api.delete(`/api/salary-advances/${advanceId}`);
    expect(deleteBlockedRes.status()).toBe(400);

    const { start, end } = previousMonthRange();
    const advancesRes = await api.get("/api/salary-advances");
    expect(advancesRes.ok()).toBeTruthy();
    const advancesJson = await advancesRes.json();
    const advances: Array<{ employeeId: string; status: string; createdAt: string }> = advancesJson.data || [];
    const paidBeforePeriodEnd = advances.some(
      (row) =>
        row.employeeId === engineer!.id &&
        String(row.status || "").toUpperCase() === "PAID" &&
        new Date(row.createdAt).getTime() <= new Date(end).getTime(),
    );

    const policyRes = await api.get(`/api/payroll/runs/policy-preview?periodStart=${start}&periodEnd=${end}`);
    expect(policyRes.ok()).toBeTruthy();
    const policyJson = await policyRes.json();
    const policyRows: Array<{ employeeId: string; deductions: number; deductionReason: string }> = policyJson.data || [];
    const engineerRow = policyRows.find((row) => row.employeeId === engineer!.id);
    expect(engineerRow).toBeTruthy();

    if (paidBeforePeriodEnd) {
      expect(Number(engineerRow?.deductions || 0)).toBeGreaterThan(0);
      expect(String(engineerRow?.deductionReason || "")).toMatch(/advance/i);
    }

    await api.dispose();
  });

  test("mobile salary advances page stays usable", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      ignoreHTTPSErrors: true,
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15A372 Safari/604.1",
    });
    const page = await context.newPage();
    await loginAs(page, FINANCE_EMAIL);

    await page.goto("/salary-advances", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Salary Advances" })).toBeVisible();

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 8);
    expect(hasOverflow).toBeFalsy();

    await expect(page.getByText("Status").first()).toBeVisible();
    await context.close();
  });
});
