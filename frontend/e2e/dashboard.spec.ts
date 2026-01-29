import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication - in real scenario, you'd login first
    await page.goto('/dashboard');
    // Wait for page to load or handle auth redirect
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard with metrics', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    // Check for stat cards
    const statCards = page.locator('[class*="StatCard"]');
    await expect(statCards.first()).toBeVisible();
  });

  test('should display charts', async ({ page }) => {
    // Wait for charts to load
    await page.waitForTimeout(1000);
    
    // Check for chart containers
    const charts = page.locator('svg, canvas, [class*="chart"]');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThan(0);
  });

  test('should have refresh button', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: /refresh/i }).or(
      page.locator('button').filter({ has: page.locator('svg') })
    );
    await expect(refreshButton.first()).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    
    // Check that layout adapts
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
  });
});
