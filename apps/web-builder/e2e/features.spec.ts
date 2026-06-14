import { test, expect } from '@playwright/test';

test.describe('DocFlow Advanced Features E2E Tests', () => {
  test('should support inline editing of tables and dynamic formulas', async ({ page }) => {
    await page.goto('/editor');

    // 1. Add Table Block
    const addTableButton = page.getByRole('button').filter({ hasText: /^Table/ });
    await expect(addTableButton).toBeVisible();
    await addTableButton.click();

    // Verify a table is rendered
    const tableHeader = page.locator('th[data-col-idx="0"]').first();
    await expect(tableHeader).toBeVisible();
    await expect(tableHeader).toHaveText('Column 1');

    // 2. Edit Table Header Inline
    await tableHeader.focus();
    await tableHeader.fill('Product Name');
    await tableHeader.blur();

    // Verify the header updated in the DOM
    await expect(tableHeader).toHaveText('Product Name');

    // 3. Edit Table Cell Inline to add a Formula
    const tableCell = page.locator('td[data-col-idx="0"]').first();
    await expect(tableCell).toBeVisible();
    
    // When cell is not focused, it shows the default value template
    await expect(tableCell).toHaveText('{{item.col1}}');

    // Focus / click the cell to edit
    await tableCell.click();
    await expect(tableCell).toHaveAttribute('contenteditable', 'true');

    // Clear and write the formula
    await tableCell.fill("{{SUM(items, 'price')}}");
    await tableCell.blur();

    // When no JSON payload exists, rowData is undefined, so it renders the raw template
    await expect(tableCell).toHaveText("{{SUM(items, 'price')}}");

    // 4. Upload JSON Payload
    // Click document page background to deselect the table block and show general settings in StyleInspector
    const documentPage = page.locator('section[aria-label="Document page"]');
    await documentPage.click({ position: { x: 5, y: 5 } });

    // Navigate to Variables settings
    const variablesTab = page.getByRole('button', { name: 'Variables', exact: true });
    await expect(variablesTab).toBeVisible();
    await variablesTab.click();

    // Locate the raw JSON textarea
    const jsonTextarea = page.locator('textarea').first();
    await expect(jsonTextarea).toBeVisible();

    // Write array data in raw JSON textarea
    const payload = {
      items: [
        { col1: 'Apple', col2: 'Fruit', price: 1.5 },
        { col1: 'Banana', col2: 'Fruit', price: 0.8 },
      ]
    };
    await jsonTextarea.fill(JSON.stringify(payload, null, 2));

    // Verify cell recalculates to 2.3 (1.5 + 0.8)
    const tableCellRecalculated = page.locator('td[data-col-idx="0"]').first();
    await expect(tableCellRecalculated).toHaveText('2.3');
  });

  test('should support nested blocks inside columns', async ({ page }) => {
    await page.goto('/editor');

    // Add Columns Block
    const addColumnsButton = page.getByRole('button').filter({ hasText: /^Columns/ });
    await expect(addColumnsButton).toBeVisible();
    await addColumnsButton.click();

    // Verify the columns block has two columns
    const columnsBlock = page.locator('div[aria-label="Columns block"]');
    await expect(columnsBlock).toBeVisible();

    // Verify we have drop targets for columns
    const columns = columnsBlock.locator('.min-h-\\[100px\\]');
    await expect(columns).toHaveCount(2);

    // Let's verify that we can select the columns block
    const sortableBlock = page.locator('[role="listitem"]').first();
    await sortableBlock.focus();
    await page.keyboard.press('Space');

    // The inspector should show columns properties
    await expect(page.locator('text=Columns properties')).toBeVisible();
  });

  test('should support configuring table row limits and display variable mapping warning indicators', async ({ page }) => {
    await page.goto('/editor');

    // 1. Add Table Block
    const addTableButton = page.getByRole('button').filter({ hasText: /^Table/ });
    await expect(addTableButton).toBeVisible();
    await addTableButton.click();

    // 2. Select Table Block to inspect styles
    const tableHeader = page.locator('th[data-col-idx="0"]').first();
    await tableHeader.click();

    // Verify properties panel is showing table settings
    await expect(page.locator('text=Table properties')).toBeVisible();

    // Verify limit input is visible
    const limitInput = page.locator('label:has-text("Row Limit")').locator('..').locator('input[type="number"]');
    await expect(limitInput).toBeVisible();

    // Set row limit to 1
    await limitInput.fill('1');
    await limitInput.blur();

    // 3. Upload JSON Payload with 2 rows
    // Deselect block to show variables panel
    const documentPage = page.locator('section[aria-label="Document page"]');
    await documentPage.click({ position: { x: 5, y: 5 } });

    // Navigate to Variables settings
    const variablesTab = page.getByRole('button', { name: 'Variables', exact: true });
    await expect(variablesTab).toBeVisible();
    await variablesTab.click();

    // Locate the raw JSON textarea
    const jsonTextarea = page.locator('textarea').first();
    await expect(jsonTextarea).toBeVisible();

    // Write array data in raw JSON textarea
    const payload = {
      items: [
        { col1: 'Apple', col2: 'Fruit', price: 1.5 },
        { col1: 'Banana', col2: 'Fruit', price: 0.8 },
      ]
    };
    await jsonTextarea.fill(JSON.stringify(payload, null, 2));

    // Verify table has only 1 row on the canvas due to the limit
    const tableRows = page.locator('table[aria-label="Table block preview"] tbody tr');
    await expect(tableRows).toHaveCount(1);

    // 4. Verify Variable mapping validation
    // Add a Paragraph block
    const addParagraphButton = page.getByRole('button').filter({ hasText: /^Paragraph/ });
    await addParagraphButton.click();

    // Focus on the paragraph, write a text with an unmapped variable
    const paragraph = page.locator('p[aria-label="Paragraph, editable"]').first();
    await paragraph.click();
    await paragraph.fill('Hello {{unmapped_value}}');
    await paragraph.blur();

    // Check if the warning alert icon is visible
    const warningIcon = page.locator('span[aria-label*="Warning: Unmapped variables"]');
    await expect(warningIcon).toBeVisible();
  });

  test('should support autocompleting functions and nested variables', async ({ page }) => {
    await page.goto('/editor');

    // Add a Paragraph block
    const addParagraphButton = page.getByRole('button').filter({ hasText: /^Paragraph/ });
    await addParagraphButton.click();

    // Focus on the paragraph and clear its default placeholder text
    const paragraph = page.locator('p[aria-label="Paragraph, editable"]').first();
    await paragraph.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');

    // Type trigger + function prefix
    await page.keyboard.type('{{SU');

    // Autocomplete menu should be visible and show SUM(
    const autocompleteMenu = page.locator('[aria-label="Variable autocomplete menu"]');
    await expect(autocompleteMenu).toBeVisible();
    await expect(autocompleteMenu.locator('text=SUM(')).toBeVisible();

    // Press enter to select SUM(
    await page.keyboard.press('Enter');

    // Paragraph should now contain "{{SUM("
    await expect(paragraph).toHaveText('{{SUM(');

    // Refocus the paragraph and move caret to the end
    await paragraph.click();
    await page.keyboard.press('End');

    // Type query inside parenthesis: c
    await page.keyboard.type('c');

    // Autocomplete should show system variable 'currentPage'
    await expect(autocompleteMenu).toBeVisible();
    await expect(autocompleteMenu.locator('text=currentPage')).toBeVisible();

    // Press enter to select currentPage
    await page.keyboard.press('Enter');

    // Paragraph should now contain "{{SUM(currentPage"
    await expect(paragraph).toHaveText('{{SUM(currentPage');
  });
});
