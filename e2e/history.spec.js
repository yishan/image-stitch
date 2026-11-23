import { expect, test } from '@playwright/test';
import { chooseDirection, expectResultSize, gotoApp, openSettings, runOnlyIn, selectFormat, setRangeWithKeyboard, uploadScreens, waitForResult } from './helpers/app.js';

test.describe('Settings undo', () => {
  runOnlyIn('desktop-chromium');

  test('re-clicking the active layout preserves redo', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await chooseDirection(page, '横向');
    await expectResultSize(page, 1000, 1600);
    await page.keyboard.press('Control+z');
    await expectResultSize(page, 500, 3200);

    await chooseDirection(page, '纵向');
    await page.keyboard.press('Control+Shift+z');
    await expectResultSize(page, 1000, 1600);
  });

  test('re-clicking the active layout adds no undo step', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await chooseDirection(page, '横向');
    await expectResultSize(page, 1000, 1600);
    await chooseDirection(page, '横向');
    await page.keyboard.press('Control+z');
    await expectResultSize(page, 500, 3200);
  });

  test('re-clicking the active export format preserves redo', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 1);
    await selectFormat(page, 'JPEG');
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeVisible();

    await selectFormat(page, 'PNG');
    await page.keyboard.press('Control+Shift+z');
    await expect(page.getByRole('button', { name: '下载 JPEG' })).toBeVisible();
  });

  test('direction and preview clicks are separate undo steps', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await waitForResult(page);
    await page.waitForTimeout(700);
    const horizontal = page.getByRole('button', { name: '横向', exact: true });
    const width = page.getByRole('button', { name: '适应宽度', exact: true });
    const started = Date.now();
    await horizontal.click();
    await width.click();
    expect(Date.now() - started).toBeLessThan(600);
    await page.keyboard.press('Control+z');
    await waitForResult(page);
    const state = {
      horizontal: await horizontal.getAttribute('aria-pressed'),
      fit: await page.getByRole('button', { name: '适应整图', exact: true }).getAttribute('aria-pressed')
    };
    console.log('After undo:', JSON.stringify(state));
    if (process.env.UNDO_SCREENSHOT) {
      await page.screenshot({ path: process.env.UNDO_SCREENSHOT, fullPage: true });
    }
    expect(state).toEqual({ horizontal: 'true', fit: 'true' });
    await page.keyboard.press('Control+z');
    await expect(horizontal).toHaveAttribute('aria-pressed', 'false');
  });

  test('custom edge typing and unchanged blur are one undo step', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await openSettings(page);
    await page.getByLabel('尺寸', { exact: true }).selectOption('custom');
    const edge = page.getByLabel('自定义长边');
    await expect(edge).toHaveValue('4096');
    await page.waitForTimeout(700);
    await edge.fill('1200');
    await edge.press('ArrowUp');
    await edge.press('ArrowUp');
    await expect(edge).toHaveValue('1280');
    // Blur after the coalescing window to catch unchanged duplicate commits.
    await page.waitForTimeout(700);
    await edge.press('Tab');
    await expectResultSize(page, 200, 1280);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await expectResultSize(page, 500, 3200);
    await page.keyboard.press('Control+Shift+z');
    await expectResultSize(page, 200, 1280);
  });

  test('slider bursts coalesce only within the same field', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await openSettings(page);
    await page.waitForTimeout(700);
    const margin = await setRangeWithKeyboard(page, '外边距', 3);
    const gap = await setRangeWithKeyboard(page, '图片间距', 3);
    await expect(margin).toHaveValue('12');
    await expect(gap).toHaveValue('12');
    await page.keyboard.press('Control+z');
    await expect(gap).toHaveValue('0');
    await expect(margin).toHaveValue('12');
    await page.keyboard.press('Control+z');
    await expect(margin).toHaveValue('0');
  });
});
