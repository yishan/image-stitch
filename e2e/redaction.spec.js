import { expect, test } from '@playwright/test';
import {
  chooseDirection,
  gotoApp,
  runOnlyIn,
  uploadScreens,
  waitForResult
} from './helpers/app.js';

const regionHash = (page) => page.locator('img.result-image').evaluate((image) => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, Math.min(300, canvas.width), Math.min(300, canvas.height)).data;
  let hash = 0;
  for (let index = 0; index < data.length; index += 13) {
    hash = (hash * 31 + data[index]) >>> 0;
  }
  return hash;
});

test.describe('X4 · 本地打码', () => {
  runOnlyIn('desktop-chromium');

  test('马赛克框选后输出像素改变，撤销与清除可恢复', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await waitForResult(page);

    const before = await regionHash(page);
    await page.getByRole('button', { name: /^打码/ }).click();
    const overlay = page.locator('.redaction-layer');
    await expect(overlay).toBeVisible();

    const imageBox = await page.locator('img.result-image').boundingBox();
    const startX = imageBox.x + imageBox.width * 0.1;
    const startY = imageBox.y + imageBox.height * 0.1;
    const endX = imageBox.x + imageBox.width * 0.4;
    const endY = imageBox.y + imageBox.height * 0.35;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 8 });
    await page.mouse.up();

    await waitForResult(page);
    await expect.poll(() => regionHash(page)).not.toBe(before);
    await expect(page.getByRole('button', { name: '打码（1）' })).toBeVisible();

    const after = await regionHash(page);
    await page.getByRole('button', { name: '撤销上一处' }).click();
    await waitForResult(page);
    await expect.poll(() => regionHash(page)).toBe(before);

    await page.getByRole('button', { name: '完成' }).click();
    await expect(overlay).toHaveCount(0);
    await expect.poll(() => regionHash(page)).toBe(before);
    await expect(after).not.toBe(before);
  });

  test('打码后导出的 PNG 仍是当前结果尺寸', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await waitForResult(page);
    await page.getByRole('button', { name: /^打码/ }).click();

    const imageBox = await page.locator('img.result-image').boundingBox();
    await page.mouse.move(imageBox.x + 40, imageBox.y + 40);
    await page.mouse.down();
    await page.mouse.move(imageBox.x + 160, imageBox.y + 160, { steps: 5 });
    await page.mouse.up();
    await waitForResult(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '下载 PNG' }).click()
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect(await download.failure()).toBeNull();
    await expect(page.locator('.output-meta')).toContainText('1000 × 1000 px');
  });

  test('色块打码会填满选中的区域', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await waitForResult(page);
    await page.getByRole('button', { name: /^打码/ }).click();
    await page.getByRole('button', { name: '色块', exact: true }).click();

    const color = page.getByLabel('色块颜色');
    await expect(color).toBeVisible();
    await color.evaluate((input) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '#ff0000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const imageBox = await page.locator('img.result-image').boundingBox();
    await page.mouse.move(imageBox.x + imageBox.width * 0.1, imageBox.y + imageBox.height * 0.1);
    await page.mouse.down();
    await page.mouse.move(imageBox.x + imageBox.width * 0.4, imageBox.y + imageBox.height * 0.35, { steps: 8 });
    await page.mouse.up();
    await waitForResult(page);

    const pixel = await page.locator('img.result-image').evaluate((image) => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return Array.from(ctx.getImageData(
        Math.floor(canvas.width * 0.25),
        Math.floor(canvas.height * 0.225),
        1,
        1
      ).data).slice(0, 3);
    });
    expect(pixel).toEqual([255, 0, 0]);
  });
});
