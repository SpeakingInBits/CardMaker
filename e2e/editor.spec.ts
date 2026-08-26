import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/');
});

test.describe('editor shell', () => {
    test('loads with an empty poker-size card', async ({ page }) => {
        await expect(page).toHaveTitle('Card Maker');
        await expect(page.locator('#cardCanvas')).toBeVisible();
        await expect(page.locator('#dimReadout')).toHaveText('750 × 1050 px');
        await expect(page.locator('#cardWidth')).toHaveValue('2.5');
        await expect(page.locator('#cardHeight')).toHaveValue('3.5');
        await expect(page.locator('#compListHint')).toBeVisible();
    });

    test('changing card size updates the pixel readout', async ({ page }) => {
        await page.fill('#cardWidth', '3');
        await expect(page.locator('#dimReadout')).toHaveText('900 × 1050 px');
        await page.fill('#cardDpi', '150');
        await expect(page.locator('#dimReadout')).toHaveText('450 × 525 px');
    });
});

test.describe('components', () => {
    test('adds a text component to the list and selects it', async ({ page }) => {
        await page.click('#addTextBtn');
        const item = page.locator('.comp-item');
        await expect(item).toHaveCount(1);
        await expect(item).toHaveClass(/selected/);
        await expect(item.locator('.comp-item-label')).toHaveText('New Text');
        await expect(page.locator('#compListHint')).toBeHidden();
    });

    test('deletes a component from the list', async ({ page }) => {
        await page.click('#addTextBtn');
        await page.click('.comp-item button[data-act="del"]');
        await expect(page.locator('.comp-item')).toHaveCount(0);
        await expect(page.locator('#compListHint')).toBeVisible();
    });

    test('undo and redo restore a component add', async ({ page }) => {
        await expect(page.locator('#undoBtn')).toBeDisabled();

        await page.click('#addTextBtn');
        await expect(page.locator('#undoBtn')).toBeEnabled();

        await page.click('#undoBtn');
        await expect(page.locator('.comp-item')).toHaveCount(0);
        await expect(page.locator('#redoBtn')).toBeEnabled();

        await page.click('#redoBtn');
        await expect(page.locator('.comp-item')).toHaveCount(1);
    });
});

test.describe('deck cards', () => {
    test('starts with one card that cannot be deleted', async ({ page }) => {
        const item = page.locator('.card-item');
        await expect(item).toHaveCount(1);
        await expect(item.locator('.card-item-name')).toHaveText('Card 1');
        await expect(item.locator('button[data-act="del"]')).toBeDisabled();
    });

    test('adds and deletes a card', async ({ page }) => {
        await page.click('#addCardBtn');
        const items = page.locator('.card-item');
        await expect(items).toHaveCount(2);
        await expect(items.nth(1)).toHaveClass(/selected/);
        await expect(items.nth(1).locator('.card-item-name')).toHaveText('Card 2');

        await items.nth(1).locator('button[data-act="del"]').click();
        await expect(items).toHaveCount(1);
    });

    test('duplicates a card with its components', async ({ page }) => {
        await page.click('#addTextBtn');
        await page.click('.card-item button[data-act="dup"]');

        const items = page.locator('.card-item');
        await expect(items).toHaveCount(2);
        await expect(items.nth(1).locator('.card-item-name')).toHaveText('Card 1 copy');
        // The copy is now active and shows its own copy of the component.
        await expect(page.locator('.comp-item')).toHaveCount(1);
    });

    test('switches between front and back faces', async ({ page }) => {
        await page.click('#addTextBtn');
        await page.click('#faceBackBtn');
        await expect(page.locator('#faceBackBtn')).toHaveClass(/active/);
        // The back face has its own (empty) component list.
        await expect(page.locator('.comp-item')).toHaveCount(0);

        await page.click('#faceFrontBtn');
        await expect(page.locator('#faceFrontBtn')).toHaveClass(/active/);
        await expect(page.locator('.comp-item')).toHaveCount(1);
    });
});
