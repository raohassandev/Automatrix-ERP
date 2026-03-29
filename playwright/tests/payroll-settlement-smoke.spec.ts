import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";

test.describe("Payroll settlement smoke (non-destructive)", () => {
  test("auto-draft endpoint is reachable, mark-paid route exists, and non-draft delete is blocked", async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL);
    await page.goto("/payroll", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Payroll", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Auto-Create Draft" })).toBeVisible();

    const autoDraftRes = await page.request.post("/api/payroll/runs/auto-draft", {
      data: { force: false },
    });
    expect(autoDraftRes.ok()).toBeTruthy();
    const autoDraftJson = await autoDraftRes.json();
    expect(autoDraftJson.success).toBeTruthy();

    const runsRes = await page.request.get("/api/payroll/runs");
    expect(runsRes.ok()).toBeTruthy();
    const runsJson = await runsRes.json();
    const runs: Array<{
      id: string;
      status: string;
      entries: Array<{ id: string; status: string }>;
    }> = runsJson.data || [];
    if (runs.length === 0) {
      test.info().annotations.push({
        type: "info",
        description: "No payroll runs found; mark-paid route probe skipped for this dataset.",
      });
      return;
    }

    const candidate = runs.find((run) =>
      ["APPROVED", "POSTED"].includes(String(run.status || "").toUpperCase()),
    );
    if (!candidate) {
      test.info().annotations.push({
        type: "info",
        description: "No approved/posted payroll run available to probe mark-paid route.",
      });
      return;
    }

    // Route availability check without modifying real data.
    const probeRes = await page.request.post(
      `/api/payroll/runs/${candidate.id}/entries/non-existent-entry-id/mark-paid`,
    );
    expect(probeRes.status()).toBe(404);
    const probeJson = await probeRes.json();
    expect(String(probeJson.error || "")).toMatch(/not found/i);

    const deleteProbeRes = await page.request.delete(`/api/payroll/runs/${candidate.id}`);
    expect(deleteProbeRes.status()).toBe(400);
    const deleteProbeJson = await deleteProbeRes.json();
    expect(String(deleteProbeJson.error || "")).toMatch(/only draft payroll runs can be deleted/i);
  });
});
