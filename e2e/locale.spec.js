import { expect, test } from '@playwright/test';
import { APP_URL, gotoApp, openSettings, runOnlyIn, uploadScreens } from './helpers/app.js';

test.describe('X6 · 国际化', () => {
  runOnlyIn('desktop-chromium');

  test('切换英文后不刷新即时生效，刷新后保持，再切回中文', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('heading', { level: 1, name: '图片拼接助手' })).toBeVisible();

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Image Stitch' })).toBeVisible();
    await expect(page.getByText('Add images', { exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/Image Stitch/);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Image Stitch' })).toBeVisible();

    await page.getByRole('button', { name: '中文' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.getByRole('heading', { level: 1, name: '图片拼接助手' })).toBeVisible();
  });

  test('未保存偏好时跟随浏览器语言', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'en-US' });
    const page = await context.newPage();
    await page.goto(APP_URL);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Image Stitch' })).toBeVisible();
    await context.close();
  });

  test('英文界面没有残留中文文案', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'English' }).click();
    await uploadScreens(page, 1);
    await openSettings(page);

    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelector('.locale-switcher')?.remove();
      clone.querySelector('noscript')?.remove();
      return clone.innerText;
    });
    expect(text).not.toMatch(/[\u4e00-\u9fff]/);
  });

  test('英文错误提示也能本地化', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'English' }).click();
    await page.locator('input[type="file"]').setInputFiles('e2e/fixtures/extreme-1200x25.png');

    const alert = page.getByRole('alert');
    await expect(alert).toContainText(/aspect ratio/i, { timeout: 20_000 });
    await expect(alert.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
});
