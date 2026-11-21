import { expect, test } from '@playwright/test';
import {
  closeSettings,
  fixture,
  gotoApp,
  openSettings,
  runOnlyIn,
  uploadFiles,
  uploadScreens,
  waitForResult,
  waitForSessionSaved
} from './helpers/app.js';

test.describe('Session recovery', () => {
  runOnlyIn('desktop-chromium');

  test('restores an image uploaded immediately after clearing the session', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 1);
    await waitForSessionSaved(page);
    await openSettings(page);
    await page.getByRole('button', { name: '清除本机会话' }).click();
    await expect(page.locator('.thumb')).toHaveCount(0);
    const clearedAt = Date.now();
    await uploadFiles(page, [fixture('screen-2.png')]);
    await expect(page.locator('.thumb')).toHaveCount(1);
    expect(Date.now() - clearedAt).toBeLessThan(1200);
    await closeSettings(page);
    await waitForResult(page);
    // Allow both persistence debounces and the former suppression window to expire.
    await page.waitForTimeout(2000);
    await page.screenshot({ path: test.info().outputPath('before-reload.png') });
    await page.reload();
    await expect(page.locator('.thumb')).toHaveCount(1);
    await expect(page.locator('.thumb img')).toHaveAttribute('alt', /screen-2\.png/);
    await waitForResult(page);
    await page.screenshot({ path: test.info().outputPath('after-reload.png') });
  });
});
