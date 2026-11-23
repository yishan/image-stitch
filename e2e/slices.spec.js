import fs from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { downloadAndRead, pngSize } from './helpers/downloads.js';
import {
  chooseDirection,
  expectResultSize,
  gotoApp,
  openSettings,
  runOnlyIn,
  uploadScreens,
  waitForResult
} from './helpers/app.js';

/**
 * Park the next canvas encode until the test releases it, so a layout change
 * can land while a multi-slice export is still running.
 */
const installEncodeHold = (page) => page.addInitScript(() => {
  const nativeToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function toBlob(callback, ...args) {
    if (!window.__holdNextEncode) return nativeToBlob.call(this, callback, ...args);
    window.__holdNextEncode = false;
    return nativeToBlob.call(this, (blob) => {
      window.__releaseEncode = () => callback(blob);
    }, ...args);
  };
});

/** Start an export, switch to 横向 while its first slice is encoding, then let it finish. */
const changeLayoutDuringExport = async (page, buttonName) => {
  await page.evaluate(() => { window.__holdNextEncode = true; });
  await page.getByRole('button', { name: buttonName }).click();
  await page.waitForFunction(() => typeof window.__releaseEncode === 'function');
  await chooseDirection(page, '横向');
  await expectResultSize(page, 1000, 1600);
  await page.evaluate(() => window.__releaseEncode());
};

const transparentPixels = (page, bytes) => page.evaluate(async (base64) => {
  const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  let count = 0;
  for (let index = 3; index < data.length; index += 4) if (data[index] === 0) count += 1;
  return count;
}, bytes.toString('base64'));

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

  test('导出切片期间切换布局，所有切片仍来自同一次渲染', async ({ page }) => {
    await installEncodeHold(page);
    await gotoApp(page);
    await uploadScreens(page, 2);
    await waitForResult(page);
    await openSettings(page);
    await page.getByLabel('切片高度').selectOption('2048');

    const downloads = [];
    page.on('download', (download) => downloads.push(download));
    await changeLayoutDuringExport(page, '下载 2 张切片');
    await expect.poll(() => downloads.length, { timeout: 20_000 }).toBe(2);

    const files = [];
    for (const download of downloads) {
      const bytes = await fs.readFile(await download.path());
      files.push({ name: download.suggestedFilename(), size: pngSize(bytes), transparent: await transparentPixels(page, bytes) });
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    expect(files).toEqual([
      { name: expect.stringMatching(/^stitch-vertical-.*-part-01-of-02\.png$/), size: { width: 500, height: 2048 }, transparent: 0 },
      { name: expect.stringMatching(/^stitch-vertical-.*-part-02-of-02\.png$/), size: { width: 500, height: 1152 }, transparent: 0 }
    ]);
  });

  test('导出 PDF 期间切换布局，所有页面仍来自同一次渲染', async ({ page }) => {
    await installEncodeHold(page);
    await gotoApp(page);
    await uploadScreens(page, 2);
    await waitForResult(page);
    await openSettings(page);
    await page.getByLabel('切片高度').selectOption('2048');

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    await changeLayoutDuringExport(page, '下载 PDF');
    const download = await downloadPromise;
    const text = (await fs.readFile(await download.path())).toString('latin1');

    expect(download.suggestedFilename()).toMatch(/^stitch-vertical-.*\.pdf$/);
    expect(text.match(/\/MediaBox \[[^\]]+\]/g)).toEqual([
      '/MediaBox [0 0 500 2048]',
      '/MediaBox [0 0 500 1152]'
    ]);
  });
});
