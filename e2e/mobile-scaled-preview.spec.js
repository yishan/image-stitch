import { expect, test } from '@playwright/test';
import { expectResultSize, fixture, gotoApp, openSettings, runOnlyIn, uploadFiles } from './helpers/app.js';

test.describe('Narrow mobile scaled preview', () => {
  runOnlyIn('mobile-chromium');
  test.use({ viewport: { width: 320, height: 740 }, hasTouch: true });

  for (const locale of ['en', 'zh']) {
    test(`scaled Fit preview and controls stay inside the stage column (${locale})`, async ({ page }) => {
      await gotoApp(page);
      if (locale === 'en') await page.getByRole('button', { name: 'English' }).click();
      await uploadFiles(page, [fixture('wide-1200x400.png'), fixture('left-right-wide.png')]);
      await expectResultSize(page, 1200, 600);
      await page.getByRole('button', { name: locale === 'en' ? 'Horizontal' : '横向' }).click();
      await openSettings(page);
      await page.getByLabel(locale === 'en' ? 'Size' : '尺寸', { exact: true }).selectOption('custom');
      await page.getByRole('spinbutton', { name: locale === 'en' ? 'Custom longest edge' : '自定义长边' }).fill('1000');
      await page.keyboard.press('Escape');
      await expect(page.locator('details.advanced')).not.toHaveAttribute('open', '');
      await expectResultSize(page, 1000, 200);
      await expect(page.locator('.stage')).toHaveAttribute('data-preview-mode', 'fit');
      await expect(page.locator('.output-meta__size')).toContainText(locale === 'en' ? 'Scaled to 1000' : '已缩放到长边 1000');

      const column = page.locator('.stage-column');
      const bounds = await column.boundingBox();
      expect(bounds).not.toBeNull();
      const elements = {
        'Fit frame and image': '.stage, .result-image',
        'Layout and preview controls': '.stitch-toolbar > .segmented button, .stitch-toolbar > .seam, .advanced-trigger',
        'Output metadata': '.output-meta > span',
        'Export actions': '.action-buttons button',
      };
      for (const [group, selector] of Object.entries(elements)) {
        for (const element of await column.locator(selector).all()) {
          const box = await element.boundingBox();
          expect(box).not.toBeNull();
          const label = `${group}: ${(await element.innerText()) || await element.getAttribute('class')}`;
          expect.soft(box.x, `${label} left edge`).toBeGreaterThanOrEqual(Math.max(0, bounds.x));
          expect.soft(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(Math.min(320, bounds.x + bounds.width));
        }
      }
    });
  }
});
