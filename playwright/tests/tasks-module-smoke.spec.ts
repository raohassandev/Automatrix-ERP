import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/auth";

const ROLE_EMAILS = {
  finance: "finance1@automatrix.pk",
  engineer: "engineer1@automatrix.pk",
} as const;

test.describe("Tasks module smoke", () => {
  test("Finance role can access tasks workspace and recurring templates", async ({ page }) => {
    await loginAs(page, ROLE_EMAILS.finance);
    await page.goto("/tasks", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Task Management" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recurring Templates" })).toBeVisible();
  });

  test("Engineer role can access tasks list but not template management controls", async ({ page }) => {
    await loginAs(page, ROLE_EMAILS.engineer);
    await page.goto("/tasks", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Task Management" })).toBeVisible();
    await page.getByRole("button", { name: "Recurring Templates" }).click();
    await expect(page.getByText("Create Recurring Template")).toHaveCount(0);
  });
});
