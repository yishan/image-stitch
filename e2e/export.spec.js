import { expect, test } from '@playwright/test';
import {
  chooseDirection,
  expectResultSize,
  gotoApp,
  outputMeta,
  runOnlyIn,
  selectFormat,
  uploadScreens
} from './helpers/app.js';
import {
  downloadAndRead,
  isJpeg,
  isPng,
  isWebp,
  jpegSize,
  pngSize
} from './helpers/downloads.js';

test.describe('导出格式', () => {
  runOnlyIn('desktop-chromium');

  test('PNG 下载的魔数、扩展名、尺寸与说明一致', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);
    await expectResultSize(page, 500, 4800);

    await expect(page.getByRole('button', { name: '下载 PNG' })).toBeEnabled();
    const file = await downloadAndRead(page, '下载 PNG');

    expect(file.filename).toMatch(/^stitch-vertical-\d{8}-\d{6}\.png$/);
    expect(isPng(file.bytes)).toBe(true);
    expect(file.bytes.length).toBeGreaterThan(1024);
    expect(pngSize(file.bytes)).toEqual({ width: 500, height: 4800 });
    await expect(outputMeta(page)).toContainText('PNG');
  });

  test('Copy reuses the current PNG output and still copies PNG for JPEG exports', async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);
    await page.evaluate(() => {
      window.copyEncodes = [];
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
        window.copyEncodes.push(type);
        return original.call(this, callback, type, quality);
      };
    });

    const copy = async (expectedEncodes) => {
      await page.evaluate(() => { window.copyEncodes = []; });
      await page.getByRole('button', { name: '复制图片', exact: true }).click();
      await expect(page.getByRole('button', { name: '已复制', exact: true })).toBeVisible();
      expect(await page.evaluate(() => window.copyEncodes)).toEqual(expectedEncodes);
      return Buffer.from(await page.evaluate(async () => {
        const [item] = await navigator.clipboard.read();
        const blob = await item.getType('image/png');
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      }));
    };

    const vertical = await downloadAndRead(page, '下载 PNG');
    expect((await copy([])).equals(vertical.bytes)).toBe(true);

    await chooseDirection(page, '横向');
    await expectResultSize(page, 1000, 1600);
    const horizontal = await downloadAndRead(page, '下载 PNG');
    expect((await copy([])).equals(horizontal.bytes)).toBe(true);

    await selectFormat(page, 'JPEG');
    expect(pngSize(await copy(['image/png']))).toEqual({ width: 1000, height: 1600 });
  });

  test('JPEG 下载的魔数、扩展名、尺寸与说明一致', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);
    await expectResultSize(page, 500, 4800);

    await selectFormat(page, 'JPEG');
    const file = await downloadAndRead(page, '下载 JPEG');

    expect(file.filename).toMatch(/\.jpg$/);
    expect(isJpeg(file.bytes)).toBe(true);
    expect(isPng(file.bytes)).toBe(false);
    expect(file.bytes.length).toBeGreaterThan(1024);
    expect(jpegSize(file.bytes)).toEqual({ width: 500, height: 4800 });
    await expect(outputMeta(page)).toContainText('JPEG · 500 × 4800 px');
  });

  test('WebP 下载的魔数、扩展名与说明一致', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);
    await expectResultSize(page, 500, 4800);

    await selectFormat(page, 'WebP');
    const file = await downloadAndRead(page, '下载 WebP');

    expect(file.filename).toMatch(/\.webp$/);
    expect(isWebp(file.bytes)).toBe(true);
    expect(file.bytes.length).toBeGreaterThan(1024);
    await expect(outputMeta(page)).toContainText('WebP · 500 × 4800 px');
  });
});
