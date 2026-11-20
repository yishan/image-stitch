import { expect, test } from '@playwright/test';
import { gotoApp, openSettings, runOnlyIn, setRangeWithKeyboard, uploadScreens, waitForResult } from './helpers/app.js';

test.describe('Settings undo', () => {
  runOnlyIn('desktop-chromium');

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
