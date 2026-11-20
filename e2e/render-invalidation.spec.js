import { expect, test } from '@playwright/test';
import { gotoApp, openSettings, runOnlyIn, setRangeWithKeyboard, uploadScreens, waitForResult } from './helpers/app.js';

test.describe('Render invalidation', () => {
  runOnlyIn('desktop-chromium');

  test('display and export-action settings do not encode the output again', async ({ page }) => {
    await gotoApp(page);
    if (process.env.STITCH_BENCH) {
      const bytes = await page.evaluate(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 4000;
        const context = canvas.getContext('2d');
        for (let y = 0; y < 4000; y += 20) {
          context.fillStyle = `hsl(${y % 360} 70% 50%)`;
          context.fillRect(0, y, 4000, 20);
        }
        const blob = await new Promise((resolve) => canvas.toBlob(resolve));
        return Array.from(new Uint8Array(await blob.arrayBuffer()));
      });
      await page.locator('input[type="file"]').setInputFiles([1, 2].map((index) => ({
        name: `large-${index}.png`, mimeType: 'image/png', buffer: Buffer.from(bytes)
      })));
    } else {
      await uploadScreens(page, 2);
    }
    await waitForResult(page);
    await page.evaluate(() => {
      window.encodeCount = 0;
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (...args) {
        window.encodeCount += 1;
        return original.apply(this, args);
      };
    });

    const measure = async (action, change) => {
      await page.evaluate(() => { window.actionStarted = performance.now(); });
      await change();
      // Allow the 160 ms render debounce to fire, including on the broken path.
      await page.waitForTimeout(250);
      await expect(page.locator('.stage')).toHaveAttribute('aria-busy', 'false');
      const result = await page.evaluate(() => ({
        count: window.encodeCount,
        ms: Math.round(performance.now() - window.actionStarted)
      }));
      console.log(`${action}: encodes=${result.count}, ms=${result.ms}`);
      return result.count;
    };

    expect.soft(await measure('fit-width', () => page.locator('.preview-modes button').nth(1).click())).toBe(0);
    await openSettings(page);
    expect.soft(await measure('slice-only', () => page.getByLabel('切片高度', { exact: true }).selectOption('2048'))).toBe(0);
    expect.soft(await measure('locale-only', () => page.getByRole('button', { name: 'English', exact: true }).click())).toBe(0);
    await openSettings(page);
    const before = await page.evaluate(() => window.encodeCount);
    expect(await measure('pixel-gap', () => setRangeWithKeyboard(page, 'Spacing', 1))).toBeGreaterThan(before);
  });
});
