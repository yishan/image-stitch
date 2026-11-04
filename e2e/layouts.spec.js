import { expect, test } from '@playwright/test';
import {
  chooseDirection,
  expectResultSize,
  fixture,
  gotoApp,
  openSettings,
  outputMeta,
  resultSize,
  runOnlyIn,
  uploadFiles,
  uploadScreens,
  waitForResult
} from './helpers/app.js';

test.describe('布局与长图', () => {
  runOnlyIn('desktop-chromium');

  test('纵向 / 横向 / 网格输出自然尺寸正确', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);

    // Default direction is vertical: 3 × (500×1600).
    await expectResultSize(page, 500, 4800);

    await chooseDirection(page, '横向');
    await expectResultSize(page, 1500, 1600);

    await chooseDirection(page, '网格');
    await expectResultSize(page, 1500, 1600);
  });

  test('长图模式放宽长边上限并保持原始宽度', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 6);

    // Default (auto) mode caps the long edge at 8192 px: 426×8192.
    await waitForResult(page);
    await expect.poll(() => resultSize(page), { timeout: 20_000 }).toEqual({
      width: 426,
      height: 8192
    });
    await expect(outputMeta(page)).toContainText('8192');

    // Long-image mode keeps the 500 px width: 500×9600.
    await openSettings(page);
    await page.getByLabel('尺寸').selectOption({ label: '长图模式（保持宽度）' });
    await expectResultSize(page, 500, 9600);
  });

  test('混合尺寸图片按最大宽度居中拼接（不放大）', async ({ page }) => {
    await gotoApp(page);
    await uploadFiles(page, [
      fixture('screen-1.png'), // 500×1600
      fixture('small-600x900.png'), // 600×900
      fixture('wide-1200x400.png') // 1200×400
    ]);
    await expect(page.locator('.thumb')).toHaveCount(3);
    await expect(page.getByText(/分辨率偏小/)).toBeVisible();

    // Vertical: widest image drives the width, heights are summed.
    await expectResultSize(page, 1200, 2900);

    await chooseDirection(page, '横向');
    await expectResultSize(page, 2300, 1600);
  });
});
