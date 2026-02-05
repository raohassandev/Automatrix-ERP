import { test, expect, type Page } from '@playwright/test';

const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

test.describe('Authentication', () => {
  const testEmail = `testuser${Date.now()}@example.com`;
  const testPassword = 'TestPass123!';
  const testName = 'Test User';
  const adminEmail = 'admin@automatrix.local';
  const adminPassword = 'admin123';

  const loginAsAdmin = async (page: Page) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill(adminEmail);
    await page.getByPlaceholder(/Password/i).fill(adminPassword);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  };

  test('should register a new user and login', async ({ page }) => {
    // Registration requires an authenticated admin session
    await loginAsAdmin(page);
    await page.goto('/login');
    
    // Fill in registration form
    await page.fill('input[placeholder="Name (for new account)"]', testName);
    await page.fill('input[placeholder="Email"]', testEmail);
    await page.fill('input[placeholder*="Password"]', testPassword);
    
    // Click create account button
    await page.click('button:has-text("Create account")');
    
    // Should redirect to dashboard after successful registration and auto-login
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
    
    // Verify we're logged in by checking for dashboard content
    await expect(page.locator('body')).toContainText('Dashboard', { timeout: 5000 });
  });

  test('should login with existing credentials', async ({ page }) => {
    // First create a user via API as admin
    await loginAsAdmin(page);
    const response = await page.request.post('/api/register', {
      data: {
        email: `existing${Date.now()}@example.com`,
        password: testPassword,
        name: 'Existing User'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    const email = data.data.email;
    
    // Now test login as that user
    await page.context().clearCookies();
    await page.goto('/login');
    
    await page.fill('input[placeholder="Email"]', email);
    await page.fill('input[placeholder*="Password"]', testPassword);
    
    // Click sign in button
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[placeholder="Email"]', 'nonexistent@example.com');
    await page.fill('input[placeholder*="Password"]', 'wrongpassword');
    
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    
    // Should show error message
    await expect(page.locator('text=/Invalid credentials|Unable to sign in|CredentialsSignin/i')).toBeVisible({ timeout: 5000 });
  });

  test('should show error for duplicate email registration', async ({ page }) => {
    const duplicateEmail = `duplicate${Date.now()}@example.com`;
    
    // Create user via API first (admin session required)
    await loginAsAdmin(page);
    await page.request.post('/api/register', {
      data: {
        email: duplicateEmail,
        password: testPassword,
        name: 'First User'
      }
    });
    
    // Try to register again with same email
    await page.goto('/login');
    
    await page.fill('input[placeholder="Name (for new account)"]', 'Second User');
    await page.fill('input[placeholder="Email"]', duplicateEmail);
    await page.fill('input[placeholder*="Password"]', testPassword);
    
    await page.click('button:has-text("Create account")');
    
    // Should show error
    await expect(page.locator('text=/Email already in use/i')).toBeVisible({ timeout: 5000 });
  });

  test('should validate email format', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/login');
    
    await page.fill('input[placeholder="Name (for new account)"]', 'Test User');
    await page.fill('input[placeholder="Email"]', 'notanemail');
    await page.fill('input[placeholder*="Password"]', testPassword);
    
    await page.click('button:has-text("Create account")');
    
    // Should show validation error
    await expect(page.locator('text=/Validation failed|Invalid email/i')).toBeVisible({ timeout: 5000 });
  });

  test('should validate password length', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/login');
    
    await page.fill('input[placeholder="Name (for new account)"]', 'Test User');
    await page.fill('input[placeholder="Email"]', `user${Date.now()}@example.com`);
    await page.fill('input[placeholder*="Password"]', 'short');
    
    await page.click('button:has-text("Create account")');
    
    // Should show validation error
    await expect(page.locator('text=/Validation failed|Password.*8/i')).toBeVisible({ timeout: 5000 });
  });

  test('should show Google sign-in button', async ({ page }) => {
    await page.goto('/login');
    
    // Google button should be present (if configured)
    const googleButton = page.locator('button:has-text("Sign in with Google")');
    if (googleEnabled) {
      await expect(googleButton).toBeVisible();
    } else {
      await expect(googleButton).toHaveCount(0);
    }
    
    // Note: We don't click it in tests as it requires real Google OAuth setup
  });
});
