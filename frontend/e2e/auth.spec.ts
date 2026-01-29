import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
  });

  test('should display login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    await emailInput.fill('invalid-email');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email/i)).toBeVisible();
  });

  test('should validate password length', async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    await emailInput.fill('test@example.com');
    await passwordInput.fill('short');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.getByRole('link', { name: /create one/i }).click();
    await expect(page).toHaveURL(/.*\/auth\/signup/);
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
  });

  test('should navigate to forgot password', async ({ page }) => {
    await page.getByRole('link', { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/.*\/auth\/forgot-password/);
    await expect(page.getByRole('heading', { name: /forgot password/i })).toBeVisible();
  });

  test('signup should validate password match', async ({ page }) => {
    await page.goto('/auth/signup');

    const passwordInput = page.getByLabel(/^password$/i);
    const confirmPasswordInput = page.getByLabel(/confirm password/i);

    await passwordInput.fill('Password123!');
    await confirmPasswordInput.fill('Different123!');
    await page.getByRole('button', { name: /create account/i }).click();

    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });
});
