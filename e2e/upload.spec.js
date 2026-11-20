import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  gotoApp,
  runOnlyIn,
  textFixture,
  fixture,
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

  test('upload notices and live region follow locale changes', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    const notice = page.locator('.notice');
    const liveRegion = page.locator('.rail-stack > [role="status"][aria-live="polite"]');
    await expect(notice).toHaveCount(0);
    await expect(liveRegion).toHaveText('');

    await uploadFiles(page, [textFixture]);
    await expect(notice).toHaveText('1 non-image file(s) skipped');
    await expect(liveRegion).toHaveText('1 non-image file(s) skipped');
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect.soft(notice).toHaveText('1 个非图片文件未添加');
    await expect(liveRegion).toHaveText('1 个非图片文件未添加');

    await uploadFiles(page, [fixture('screen-1.png')]);
    await expect(notice).toHaveCount(0);
    await expect(liveRegion).toHaveText('');
  });

  test('combined upload notices follow locale changes', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    const buffer = await readFile(fixture('screen-1.png'));
    await uploadFiles(page, [
      textFixture,
      { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
      ...Array.from({ length: 7 }, (_, index) => ({
        name: `screen-${index}.png`, mimeType: 'image/png', buffer
      }))
    ]);
    const english = '1 non-image file(s) skipped; 1 image(s) over 10 MiB skipped; Limit is 6 images; 1 skipped';
    const chinese = '1 个非图片文件未添加；1 张图片超过 10 MiB，已忽略；最多保留 6 张图片，已忽略 1 张';
    const notice = page.locator('.notice');
    const liveRegion = page.locator('.rail-stack > [role="status"][aria-live="polite"]');
    await expect(notice).toHaveText(english);
    await expect(liveRegion).toHaveText(english);
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect(notice).toHaveText(chinese);
    await expect(liveRegion).toHaveText(chinese);
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(notice).toHaveText(english);
    await expect(liveRegion).toHaveText(english);
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
