import { test, expect } from '@playwright/test';

test.describe('Forgot Password Flow', () => {
  test('should display forgot password page', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('invalid-email');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('should show success message after email sent', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    
    // Mock successful API response
    await page.route('**/api/v1/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ message: 'Email sent' }),
      });
    });

    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('test@example.com');
    await page.getByRole('button', { name: /send reset link/i }).click();

    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test('should display reset password form with token', async ({ page }) => {
    await page.goto('/auth/forgot-password?token=test-token');
    
    await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
    await expect(page.getByLabel(/new password/i)).toBeVisible();
    await expect(page.getByLabel(/confirm password/i)).toBeVisible();
  });

  test('should validate password requirements', async ({ page }) => {
    await page.goto('/auth/forgot-password?token=test-token');
    
    const passwordInput = page.getByLabel(/new password/i);
    await passwordInput.fill('weak');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('should validate password match', async ({ page }) => {
    await page.goto('/auth/forgot-password?token=test-token');
    
    const passwordInput = page.getByLabel(/new password/i);
    const confirmInput = page.getByLabel(/confirm password/i);
    
    await passwordInput.fill('Password123!');
    await confirmInput.fill('Different123!');
    await page.getByRole('button', { name: /reset password/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});
