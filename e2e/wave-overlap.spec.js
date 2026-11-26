import { expect, test } from '@playwright/test';
import { chooseDirection, expectResultSize, fixture, gotoApp, runOnlyIn, uploadFiles } from './helpers/app.js';
import { downloadAndRead } from './helpers/downloads.js';

const compareSeamPixels = (page, wave, straight, { horizontal, seam, from, to }) => (
  page.evaluate(async ({ pngs, horizontal, seam, from, to }) => {
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
    const length = horizontal ? wavy.height : wavy.width;
    let outside = 0;
    let shiftedImageColor = 0;
    for (let along = 0; along < length; along += 1) {
      for (let across = seam - 8; across < seam + 8; across += 1) {
        const x = horizontal ? across : along;
        const y = horizontal ? along : across;
        const index = (y * wavy.width + x) * 4;
        if (wavy.data.subarray(index, index + 4).every((value, i) => value === flat.data[index + i])) continue;
        if (along < from || along >= to) {
          outside += 1;
        } else if (flat.data[index + 3] === 255) {
          // Gray strokes can't increase red-to-blue contrast on an opaque pixel.
          const redContrast = wavy.data[index] - wavy.data[index + 2];
          const flatContrast = flat.data[index] - flat.data[index + 2];
          if (redContrast > flatContrast + 32) shiftedImageColor += 1;
        }
      }
    }
    return { outside, shiftedImageColor };
  }, {
    pngs: [wave, straight].map((bytes) => `data:image/png;base64,${bytes.toString('base64')}`),
    horizontal, seam, from, to
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

        await page.getByRole('checkbox', { name: '波浪接缝' }).uncheck();
        await expectResultSize(page, width, height);
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
});
