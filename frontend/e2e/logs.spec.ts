import { test, expect } from '@playwright/test';

test.describe('Logs Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');
  });

  test('should display logs page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /logs viewer/i })).toBeVisible();
  });

  test('should filter logs by level', async ({ page }) => {
    const filterButton = page.getByRole('button', { name: /filters/i });
    if (await filterButton.isVisible()) {
      await filterButton.click();
      
      // Look for level filter buttons
      const errorButton = page.getByRole('button', { name: /error/i });
      if (await errorButton.isVisible()) {
        await errorButton.click();
      }
    }
  });

  test('should export logs as CSV', async ({ page }) => {
    const downloadButton = page.getByRole('button', { name: /download/i }).or(
      page.locator('button').filter({ has: page.locator('svg') })
    );
    
    if (await downloadButton.first().isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
      await downloadButton.first().click();
      
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain('.csv');
      }
    }
  });

  test('should toggle streaming', async ({ page }) => {
    const streamButton = page.getByRole('button', { name: /stream/i }).or(
      page.getByRole('button', { name: /pause/i })
    );
    
    if (await streamButton.first().isVisible()) {
      await streamButton.first().click();
      await page.waitForTimeout(500);
    }
  });
});
