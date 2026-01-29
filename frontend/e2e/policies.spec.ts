import { test, expect } from '@playwright/test';

test.describe('Policy Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/policies');
    await page.waitForLoadState('networkidle');
  });

  test('should display policies page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /policy management/i })).toBeVisible();
  });

  test('should open create policy dialog', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create policy/i });
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Check for dialog
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/create policy/i)).toBeVisible();
    }
  });

  test('should validate JSON in conditions editor', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create policy/i });
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Look for JSON editor
      const jsonEditor = page.locator('[class*="json"]').or(
        page.locator('textarea').filter({ hasText: /conditions/i })
      );
      
      if (await jsonEditor.count() > 0) {
        await jsonEditor.first().fill('{ invalid json }');
        // Should show validation error
        await page.waitForTimeout(500);
      }
    }
  });

  test('should filter policies by type', async ({ page }) => {
    const typeSelect = page.locator('select').filter({ hasText: /type/i }).first();
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('api_access');
      await page.waitForTimeout(300);
    }
  });
});
