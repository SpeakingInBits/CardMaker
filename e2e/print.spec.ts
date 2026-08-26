import { expect, test, type Page } from '@playwright/test';

async function openPrintDialog(page: Page): Promise<void> {
    await page.click('#printSheetBtn');
    await expect(page.locator('#printModal')).toHaveClass(/open/);
}

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('print dialog', () => {
    test('shows the default Letter layout for one poker card', async ({ page }) => {
        await openPrintDialog(page);
        await expect(page.locator('#printMargin')).toHaveValue('0.25');
        await expect(page.locator('#printGap')).toHaveValue('0');
        await expect(page.locator('#printLayoutInfo')).toContainText('1 card · 3 × 3 per page → 1 sheet');
    });

    // Issue #5: standard paper sizes plus a custom option.
    test('offers the standard paper sizes and a custom option', async ({ page }) => {
        await openPrintDialog(page);
        const values = await page
            .locator('#printPaper option')
            .evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
        expect(values).toEqual(['letter', 'legal', 'tabloid', 'a3', 'a4', 'a5', 'custom']);
    });

    test('larger paper fits more cards per page', async ({ page }) => {
        await openPrintDialog(page);
        await page.selectOption('#printPaper', 'tabloid');
        await expect(page.locator('#printLayoutInfo')).toContainText('4 × 4 per page');
    });

    // Issue #5: custom paper dimensions.
    test('custom paper size reveals dimension inputs and relayouts', async ({ page }) => {
        await openPrintDialog(page);
        await expect(page.locator('#printCustomSizeRow')).toBeHidden();

        await page.selectOption('#printPaper', 'custom');
        await expect(page.locator('#printCustomSizeRow')).toBeVisible();

        await page.fill('#printCustomWidth', '5.5');
        await page.fill('#printCustomHeight', '8');
        await expect(page.locator('#printLayoutInfo')).toContainText('2 × 2 per page');
    });

    test('warns when the card does not fit the custom paper', async ({ page }) => {
        await openPrintDialog(page);
        await page.selectOption('#printPaper', 'custom');
        await page.fill('#printCustomWidth', '2');
        await page.fill('#printCustomHeight', '2');
        await expect(page.locator('#printLayoutInfo')).toContainText('does not fit');
        await expect(page.locator('#printGenerateBtn')).toBeDisabled();

        // Recovering to a valid size re-enables the button.
        await page.selectOption('#printPaper', 'letter');
        await expect(page.locator('#printGenerateBtn')).toBeEnabled();
    });

    // Issue #4: adjustable margins / borderless printing.
    test('a thinner margin fits more rows (borderless on Legal)', async ({ page }) => {
        await openPrintDialog(page);
        await page.selectOption('#printPaper', 'legal');
        await expect(page.locator('#printLayoutInfo')).toContainText('3 × 3 per page');

        await page.fill('#printMargin', '0');
        await expect(page.locator('#printLayoutInfo')).toContainText('3 × 4 per page');
    });

    // Issue #6: adjustable gap between cards.
    test('a card gap reduces cards per page', async ({ page }) => {
        await openPrintDialog(page);
        await expect(page.locator('#printLayoutInfo')).toContainText('3 × 3 per page');

        await page.fill('#printGap', '0.25');
        await expect(page.locator('#printLayoutInfo')).toContainText('3 × 2 per page');
    });

    test('sheet count follows the deck copy counts', async ({ page }) => {
        await page.fill('.card-item .card-copies input', '10');
        await page.keyboard.press('Enter');
        await openPrintDialog(page);
        await expect(page.locator('#printLayoutInfo')).toContainText('10 cards · 3 × 3 per page → 2 sheets');
    });

    test('generates and downloads the print-sheet PDF', async ({ page }) => {
        await openPrintDialog(page);
        const downloadPromise = page.waitForEvent('download');
        await page.click('#printGenerateBtn');
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('Untitled_print_sheet.pdf');
        await expect(page.locator('.toast-success')).toContainText('Print sheet PDF created');
    });

    test('generates a PDF with custom margins, gap, and paper', async ({ page }) => {
        await openPrintDialog(page);
        await page.selectOption('#printPaper', 'a4');
        await page.fill('#printMargin', '0');
        await page.fill('#printGap', '0.125');
        await expect(page.locator('#printGenerateBtn')).toBeEnabled();

        const downloadPromise = page.waitForEvent('download');
        await page.click('#printGenerateBtn');
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('Untitled_print_sheet.pdf');
    });
});
