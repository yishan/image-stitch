import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { downloadAndRead, pngSize } from './helpers/downloads.js';
import {
  gotoApp,
  openSettings,
  runOnlyIn,
  uploadScreens,
  waitForResult
} from './helpers/app.js';

test.describe('X3 · 切片与 PDF 导出', () => {
  runOnlyIn('desktop-chromium');

  test('按高度切片并下载可排序的 PNG 文件', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await waitForResult(page);
    await openSettings(page);

    await page.getByLabel('切片高度').selectOption('2048');
    await expect(page.getByRole('button', { name: '下载 2 张切片' })).toBeVisible();

    const downloads = [];
    page.on('download', (download) => downloads.push(download));
    await page.getByRole('button', { name: '下载 2 张切片' }).click();
    await expect.poll(() => downloads.length, { timeout: 20_000 }).toBe(2);

    const names = downloads.map((download) => download.suggestedFilename()).sort();
    expect(names).toEqual([
      expect.stringMatching(/-part-01-of-02\.png$/),
      expect.stringMatching(/-part-02-of-02\.png$/)
    ]);

    const sizes = [];
    for (const download of downloads) {
      const bytes = await fs.readFile(await download.path());
      sizes.push(pngSize(bytes));
    }
    expect(sizes).toEqual([
      { width: 500, height: 2048 },
      { width: 500, height: 1152 }
    ]);
  });

  test('PDF 导出包含与切片数量一致的页面', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await waitForResult(page);
    await openSettings(page);
    await page.getByLabel('切片高度').selectOption('2048');

    const { bytes, filename } = await downloadAndRead(page, '下载 PDF');
    const text = bytes.toString('latin1');

    expect(filename).toMatch(/\.pdf$/);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/MediaBox [0 0 500 2048]');
    expect((text.match(/\/Type \/Page\s/g) || []).length).toBe(2);
  });
});
