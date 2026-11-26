import { expect, test } from '@playwright/test';
import {
  chooseDirection, expectResultSize, fixture, gotoApp, openSettings, runOnlyIn, uploadFiles
} from './helpers/app.js';
import { downloadAndRead } from './helpers/downloads.js';

const compareSeamPixels = (page, wave, straight, { horizontal, seam, from, to, end }) => (
  page.evaluate(async ({ pngs, horizontal, seam, from, to, end }) => {
    const readPixels = async (dataUrl) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    };
    const [wavy, flat] = await Promise.all(pngs.map(readPixels));
    const length = end ?? (horizontal ? wavy.height : wavy.width);
    let outside = 0;
    let outsideAlpha = 0;
    let insideAlpha = 0;
    let shiftedImageColor = 0;
    for (let along = 0; along < length; along += 1) {
      for (let across = seam - 8; across < seam + 8; across += 1) {
        const x = horizontal ? across : along;
        const y = horizontal ? along : across;
        const index = (y * wavy.width + x) * 4;
        if (wavy.data.subarray(index, index + 4).every((value, i) => value === flat.data[index + i])) continue;
        if (along < from || along >= to) {
          outside += 1;
          if (wavy.data[index + 3] !== flat.data[index + 3]) outsideAlpha += 1;
        } else {
          if (wavy.data[index + 3] !== flat.data[index + 3]) insideAlpha += 1;
          if (flat.data[index + 3] !== 255) continue;
          // Gray strokes can't increase red-to-blue contrast on an opaque pixel.
          const redContrast = wavy.data[index] - wavy.data[index + 2];
          const flatContrast = flat.data[index] - flat.data[index + 2];
          if (redContrast > flatContrast + 32) shiftedImageColor += 1;
        }
      }
    }
    return { outside, outsideAlpha, insideAlpha, shiftedImageColor };
  }, {
    pngs: [wave, straight].map((bytes) => `data:image/png;base64,${bytes.toString('base64')}`),
    horizontal, seam, from, to, end
  })
);

test.describe('Wave seam overlap', () => {
  runOnlyIn('desktop-chromium');

  for (const { direction, width, height, from, to, seams } of [
    { direction: '横向', width: 1700, height: 1600, from: 600, to: 1000, seams: [500, 1200] },
    { direction: '纵向', width: 1200, height: 2000, from: 350, to: 850, seams: [1600, 400] }
  ]) {
    for (const [index, seam] of seams.entries()) {
      const order = index === 0 ? 'tall first' : 'wide first';
      test(`${direction}, ${order}: waves change only the shared edge`, async ({ page }, testInfo) => {
        const images = [fixture('screen-1.png'), fixture('wide-1200x400.png')];
        if (index === 1) images.reverse();
        await gotoApp(page);
        await uploadFiles(page, images);
        await chooseDirection(page, direction);
        await expectResultSize(page, width, height);
        const { bytes: wave } = await downloadAndRead(page, '下载 PNG');

        const previous = await page.locator('img.result-image').getAttribute('src');
        await page.getByRole('checkbox', { name: '波浪接缝' }).uncheck();
        await expect(page.locator('img.result-image')).not.toHaveAttribute('src', previous);
        const { bytes: straight } = await downloadAndRead(page, '下载 PNG');

        await testInfo.attach('wave-export', { body: wave, contentType: 'image/png' });
        const changed = await compareSeamPixels(page, wave, straight, {
          horizontal: direction === '横向', seam, from, to
        });
        expect(changed.shiftedImageColor, 'the wave clips and moves image color in the overlap').toBeGreaterThan(0);
        expect(changed.outside, 'pixels changed outside the overlap').toBe(0);
      });
    }
  }

  for (const gap of [0, 32]) {
    test(`Grid Auto: waves stay on shared edges at ${gap} px spacing`, async ({ page }, testInfo) => {
      await gotoApp(page);
      await uploadFiles(page, [
        fixture('screen-1.png'), fixture('wide-1200x400.png'),
        fixture('screen-2.png'), fixture('small-600x900.png')
      ]);
      await chooseDirection(page, '网格');
      await expect(page.getByLabel('网格布局')).toHaveValue('auto');
      if (gap) {
        await openSettings(page);
        await page.getByLabel('图片间距').fill(String(gap));
      }
      await expectResultSize(page, 1700 + gap, 3200 + gap);
      const { download, bytes: wave } = await downloadAndRead(page, '下载 PNG');
      const exportPath = testInfo.outputPath('wave-export.png');
      await download.saveAs(exportPath);
      await testInfo.attach('wave-export', { path: exportPath, contentType: 'image/png' });

      const previous = await page.locator('img.result-image').getAttribute('src');
      await page.getByRole('checkbox', { name: '波浪接缝' }).uncheck();
      await expect(page.locator('img.result-image')).not.toHaveAttribute('src', previous);
      const { bytes: straight } = await downloadAndRead(page, '下载 PNG');

      const sideBySide = await compareSeamPixels(page, wave, straight, {
        horizontal: true, seam: 500, from: 600, to: 1000, end: 1592
      });
      const betweenRows = await compareSeamPixels(page, wave, straight, {
        horizontal: false, seam: 1600, from: 300, to: 500
      });
      expect.soft(sideBySide.outsideAlpha, 'keep exposed sides straight').toBe(0);
      expect.soft(betweenRows.outsideAlpha, 'keep empty space between rows clear').toBe(0);
      expect(sideBySide.insideAlpha, 'keep the wave between side-by-side images').toBeGreaterThan(0);
      expect(betweenRows.insideAlpha, 'keep the wave between rows').toBeGreaterThan(0);
    });
  }
});
