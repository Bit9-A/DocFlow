import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('DocFlow Accessibility & Keyboard Navigation E2E Tests', () => {
  test('should pass basic accessibility audit on load', async ({ page }) => {
    await page.goto('/editor');
    
    // Wait for the main page elements to render
    await expect(page.getByAltText('DocFlow')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      // Disable rules that are external or known issues in development setup if any
      .disableRules(['color-contrast']) // We test contrast custom in style inspector
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should navigate using keyboard and select blocks', async ({ page }) => {
    await page.goto('/editor');

    // Initially, there's no selection
    await expect(page.locator('aside[aria-label="Style inspector — page settings"]')).toBeVisible();

    // The canvas has a button to add heading when empty
    const addHeadingButton = page.getByRole('button', { name: 'Add Heading' });
    await expect(addHeadingButton).toBeVisible();

    // Tab to it and press Enter
    await page.keyboard.press('Tab');
    await addHeadingButton.focus();
    await page.keyboard.press('Enter');

    // The canvas announcer should update
    const announcer = page.locator('#canvas-announcer');
    await expect(announcer).toContainText('Added new heading block');

    // Focus the newly added block
    // It should have tabIndex = 0
    const headingBlock = page.locator('[role="listitem"]').first();
    await expect(headingBlock).toBeVisible();

    // Press space to select the block
    await headingBlock.focus();
    await page.keyboard.press('Space');

    // Check style inspector has heading styles and selected text color details
    await expect(page.locator('aside[aria-label="Style inspector"]')).toBeVisible();
    await expect(page.locator('text=Contrast (on white):')).toBeVisible();
  });

  test('should move blocks using keyboard shortcuts and announce movement', async ({ page }) => {
    await page.goto('/editor');

    // Add a heading block
    await page.getByRole('button', { name: 'Add Heading' }).click();
    await expect(page.locator('#canvas-announcer')).toContainText('Added new heading block');

    // Focus the block
    const headingBlock = page.locator('[role="listitem"]').first();
    await expect(headingBlock).toBeVisible();
    await headingBlock.focus();

    // Press space to select it
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);

    // Press arrow down to move it
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(250);

    // It should announce coordinate change
    await expect(page.locator('#canvas-announcer')).toContainText('Moved block to 50, 45');
  });
});

