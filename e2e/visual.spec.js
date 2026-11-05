import { expect, test } from '@playwright/test';
import {
  chooseDirection,
  expectResultSize,
  gotoApp,
  runOnlyIn,
  uploadScreens,
  waitForResult
} from './helpers/app.js';

/**
 * Screenshot the exported result at its natural size in a blank tab. This
 * avoids the stage's fit-to-viewport scaling (and host fonts entirely), which
 * keeps the baselines stable across macOS and the Linux CI runner.
 */
const captureNaturalResult = async (page) => {
  const result = await page.locator('img.result-image').evaluate(async (image) => {
    const response = await fetch(image.src);
    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { dataUrl, width: image.naturalWidth, height: image.naturalHeight };
  });

  const shot = await page.context().newPage();
  await shot.setViewportSize({ width: result.width, height: result.height });
  await shot.setContent(
    `<!doctype html><html><head><style>
      html, body { margin: 0; background: #fff; }
      #result { display: block; width: ${result.width}px; height: ${result.height}px; }
    </style></head><body><img id="result" alt="" src="${result.dataUrl}"></body></html>`
  );
  await shot.locator('#result').evaluate((image) => image.decode());

  return { shot, width: result.width, height: result.height };
};

const expectResultScreenshot = async (page, name) => {
  const { shot, width, height } = await captureNaturalResult(page);
  await expect(shot.locator('#result')).toHaveScreenshot(name);
  await shot.close();
  return { width, height };
};

test.describe('视觉回归 · 导出结果', () => {
  runOnlyIn('desktop-chromium');

  test('纵向两张截图的默认输出', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);
    await waitForResult(page);

    const { width, height } = await expectResultScreenshot(page, 'vertical-two-screens.png');
    expect({ width, height }).toEqual({ width: 500, height: 3200 });
  });

  test('旋转第一张后的纵向输出', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await page.locator('.thumb-frame').first().click();
    await page.getByRole('button', { name: '旋转 90°' }).click();
    await expectResultSize(page, 1600, 2100);
    await waitForResult(page);

    const { width, height } = await expectResultScreenshot(page, 'vertical-rotated.png');
    expect({ width, height }).toEqual({ width: 1600, height: 2100 });
  });

  test('2×2 网格的输出', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await expectResultSize(page, 1000, 1000);
    await waitForResult(page);

    const { width, height } = await expectResultScreenshot(page, 'grid-2x2.png');
    expect({ width, height }).toEqual({ width: 1000, height: 1000 });
  });
});
