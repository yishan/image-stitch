import { expect, test } from '@playwright/test';
import { fixture, gotoApp, runOnlyIn, uploadFiles, waitForResult } from './helpers/app.js';

test.describe('Thumbnail touch selection', () => {
  runOnlyIn('mobile-chromium');
  test.use({ isMobile: true, hasTouch: true });

  for (const width of [320, 375]) {
    for (const language of ['en', 'zh']) {
      test(`${width}px ${language}: centre selects and × removes`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await gotoApp(page);
        if (language === 'en') await page.getByRole('button', { name: 'English', exact: true }).click();
        await uploadFiles(page, ['screen-1.png', 'wide-1200x400.png', 'small-600x900.png'].map(fixture));
        await expect(page.locator('.thumb')).toHaveCount(3);
        await waitForResult(page);
        const first = page.locator('.thumb').first();
        const frame = first.locator('.thumb-frame');
        await frame.scrollIntoViewIfNeeded();
        const box = await frame.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await expect(page.locator('.thumb')).toHaveCount(3);
        await expect(first).toHaveAttribute('data-selected', 'true');
        await expect(first.locator('img')).toHaveAttribute('alt', /screen-1\.png/);
        const remove = first.locator('.thumb-remove');
        await expect(remove).toBeVisible();
        await first.locator('.thumb-remove svg').tap();
        await expect(page.locator('.thumb')).toHaveCount(2);
        await expect(page.locator('.thumb img').first()).toHaveAttribute('alt', /wide-1200x400\.png/);
      });
    }
  }
});
