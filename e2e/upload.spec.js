import { expect, test } from '@playwright/test';
import {
  gotoApp,
  runOnlyIn,
  textFixture,
  uploadFiles,
  uploadScreens
} from './helpers/app.js';

test.describe('上传与编辑', () => {
  runOnlyIn('desktop-chromium');

  test('上传三张图片后显示缩略图、计数并开始拼接', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);

    await expect(page.getByRole('heading', { name: '已选图片' })).toBeVisible();
    await expect(page.locator('.thumb')).toHaveCount(3);
    await expect(page.locator('.preview-count')).toHaveText('3 / 6');
    await expect(page.locator('img.result-image')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.stage')).toHaveAttribute('aria-busy', 'false');
  });

  test('非图片文件被拒绝并提示原因', async ({ page }) => {
    await gotoApp(page);
    await uploadFiles(page, [textFixture]);

    await expect(page.locator('.notice')).toContainText('1 个非图片文件未添加');
    await expect(page.locator('.thumb')).toHaveCount(0);
    await expect(page.getByText('长图会出现在这里')).toBeVisible();
  });

  test('移除一张图片后计数更新，清空后回到空状态', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);

    await page.getByRole('button', { name: /移除第 1 张图片/ }).click();
    await expect(page.locator('.thumb')).toHaveCount(2);
    await expect(page.locator('.preview-count')).toHaveText('2 / 6');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '清空' }).click();
    await expect(page.locator('.thumb')).toHaveCount(0);
    await expect(page.getByText('长图会出现在这里')).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);
  });
});
