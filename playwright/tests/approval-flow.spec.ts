import { test, expect, type Page } from '@playwright/test';

const adminEmail = 'admin@automatrix.local';
const adminPassword = 'admin123';

const loginAsAdmin = async (page: Page) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(adminEmail);
  await page.getByPlaceholder(/Password/i).fill(adminPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
};

test('approval flow: create expense and approve', async ({ page }) => {
  const unique = Date.now();
  await loginAsAdmin(page);

  const clientRes = await page.request.post('/api/clients', {
    data: {
      name: `Approval Test Client ${unique}`,
      description: 'Automation test client',
    },
  });
  expect(clientRes.ok()).toBeTruthy();
  const clientData = await clientRes.json();
  const clientId = clientData.data.id as string;

  const projectId = `AT-${unique}`;
  const projectRes = await page.request.post('/api/projects', {
    data: {
      projectId,
      name: `Approval Test Project ${unique}`,
      clientId,
      startDate: new Date().toISOString(),
      contractValue: 10000,
    },
  });
  expect(projectRes.ok()).toBeTruthy();

  const description = `Approval expense ${unique}`;
  const expenseRes = await page.request.post('/api/expenses', {
    data: {
      date: new Date().toISOString(),
      description,
      category: 'Approval Test',
      amount: 100,
      paymentMode: 'Cash',
      paymentSource: 'COMPANY_DIRECT',
      expenseType: 'COMPANY',
      project: projectId,
      ignoreDuplicate: true,
    },
  });
  const expenseData = await expenseRes.json();
  expect(expenseRes.ok(), JSON.stringify(expenseData)).toBeTruthy();

  await page.goto('/approvals');
  const searchBox = page.getByPlaceholder('Search by category, project, employee...');
  await searchBox.fill(description);

  const row = page.locator('tr', { hasText: description });
  await expect(row).toBeVisible({ timeout: 10_000 });
  await row.getByRole('button', { name: 'Approve' }).click();

  const modalHeading = page.getByRole('heading', { name: 'Approve Expense' });
  await expect(modalHeading).toBeVisible({ timeout: 5_000 });
  const modal = modalHeading.locator('..');
  await modal.getByRole('button', { name: 'Approve', exact: true }).click();

  await expect(row).toHaveCount(0, { timeout: 10_000 });
});
