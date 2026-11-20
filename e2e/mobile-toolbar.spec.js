import { expect, test } from '@playwright/test';
import { gotoApp, runOnlyIn, uploadScreens, waitForResult } from './helpers/app.js';

test.describe('Narrow mobile preview toolbar', () => {
  runOnlyIn('mobile-chromium');
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });

  for (const locale of ['en', 'zh']) {
    test(`all toolbar controls fit the viewport (${locale})`, async ({ page }) => {
      await gotoApp(page);
      if (locale === 'en') await page.getByRole('button', { name: 'English' }).click();
      await uploadScreens(page, 1);
      await waitForResult(page);
      const toolbar = page.locator('.stitch-toolbar');
      await toolbar.scrollIntoViewIfNeeded();
      const controls = toolbar.locator(':scope > .segmented button, :scope > .seam, :scope > details > summary');
      await expect(controls).toHaveCount(7);
      for (const control of await controls.all()) {
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box).not.toBeNull();
        const label = await control.innerText();
        expect.soft(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
        expect.soft(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(320);
      }
    });
  }
});
