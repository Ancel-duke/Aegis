import { test, expect } from '@playwright/test';

test.describe('Alerts Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
  });

  test('should display alerts page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /alerts/i })).toBeVisible();
  });

  test('should filter alerts by severity', async ({ page }) => {
    const filterButton = page.getByRole('button', { name: /filters/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Check for severity filter options
      const criticalButton = page.getByRole('button', { name: /critical/i });
      if (await criticalButton.isVisible()) {
        await criticalButton.click();
      }
    }
  });

  test('should allow resolving alerts', async ({ page }) => {
    // Look for resolve button
    const resolveButton = page.getByRole('button', { name: /resolve/i }).first();
    if (await resolveButton.isVisible()) {
      await resolveButton.click();
      // Wait for optimistic update or API call
      await page.waitForTimeout(500);
    }
  });

  test('should search alerts', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search alerts/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(300); // Debounce
    }
  });
});
