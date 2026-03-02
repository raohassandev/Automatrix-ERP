import { expect, request, test } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const FINANCE_EMAIL = process.env.E2E_FINANCE_EMAIL || "finance1@automatrix.pk";
const TARGET_PROJECT_ID = "AE-PV-IS-463";

test.describe("Project regression: AE-PV-IS-463", () => {
  test("pending amount and inventory fallback are visible for project detail", async ({ page }) => {
    await loginAs(page, FINANCE_EMAIL);

    await page.goto(`/projects?search=${encodeURIComponent(TARGET_PROJECT_ID)}`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
    await expect(page.locator("main")).toContainText(TARGET_PROJECT_ID);
    await expect(page.locator("main")).toContainText(/105[, ]?000/);

    const projectLink = page
      .locator("main table tbody tr")
      .filter({ hasText: TARGET_PROJECT_ID })
      .first()
      .locator('a[href^="/projects/"]')
      .first();
    await expect(projectLink).toBeVisible();
    await projectLink.click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/);

    await expect(page.locator("main")).toContainText(/pending recovery/i);
    await expect(page.locator("main")).toContainText(/105[, ]?000/);
    await expect(page.locator("main")).toContainText(/invoice pending/i);

    await page.getByRole("button", { name: "Inventory" }).click();
    await expect(page.locator("main")).toContainText(/no stock ledger movement found/i);
    await expect(page.locator("main")).toContainText(/expense fallback/i);
  });

  test("project delete returns meaningful result (no 500)", async ({ page, baseURL }) => {
    await loginAs(page, FINANCE_EMAIL);
    const storage = await page.context().storageState();
    const api = await request.newContext({
      baseURL,
      storageState: storage,
      ignoreHTTPSErrors: true,
    });

    const projectsRes = await api.get("/api/projects");
    expect(projectsRes.ok()).toBeTruthy();
    const projectsJson = await projectsRes.json();
    const target = (projectsJson?.data || []).find((p: { projectId?: string }) => p.projectId === TARGET_PROJECT_ID);
    expect(target?.id).toBeTruthy();

    const clientsRes = await api.get("/api/clients");
    expect(clientsRes.ok()).toBeTruthy();
    const clientsJson = await clientsRes.json();
    const clientId = clientsJson?.data?.[0]?.id as string | undefined;
    expect(clientId).toBeTruthy();

    const unique = Date.now();
    const newProjectId = `AUDIT-DEL-${unique}`;
    const createRes = await api.post("/api/projects", {
      data: {
        projectId: newProjectId,
        name: `Audit Delete ${unique}`,
        clientId,
        startDate: new Date().toISOString().slice(0, 10),
        contractValue: 1000,
        status: "ACTIVE",
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    const createdId = created?.data?.id as string | undefined;
    expect(createdId).toBeTruthy();

    const deleteCreatedRes = await api.delete(`/api/projects/${createdId}`);
    expect(deleteCreatedRes.ok()).toBeTruthy();

    const deleteTargetRes = await api.delete(`/api/projects/${target.id}`);
    // Real project with linked records must not return 500.
    expect([200, 409]).toContain(deleteTargetRes.status());

    await api.dispose();
  });
});
