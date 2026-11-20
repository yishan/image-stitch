import { expect, test } from '@playwright/test';
import { gotoApp, runOnlyIn, uploadScreens, waitForResult } from './helpers/app.js';

test.describe('Narrow mobile result actions', () => {
  runOnlyIn('mobile-chromium');
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });

  for (const locale of ['en', 'zh']) {
    test(`all result actions fit the viewport (${locale})`, async ({ page }) => {
      await gotoApp(page);
      if (locale === 'en') await page.getByRole('button', { name: 'English' }).click();
      await uploadScreens(page, 1);
      await waitForResult(page);
      await page.locator('.stitch-actions').scrollIntoViewIfNeeded();

      const buttons = page.locator('.action-buttons button');
      await expect(buttons).toHaveCount(4);
      for (const button of await buttons.all()) {
        await expect(button).toBeEnabled();
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        const label = await button.innerText();
        expect.soft(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
        expect.soft(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(320);
      }
    });
  }
});
