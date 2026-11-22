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

  test('keeps an upload and its undo step when startup restore finishes', async ({ page, context }, testInfo) => {
    await gotoApp(page);
    await uploadScreens(page, 1);
    await waitForSessionSaved(page);

    const keeper = await context.newPage();
    await keeper.route('**/session-lock', (route) => route.fulfill({ contentType: 'text/html', body: '' }));
    await keeper.goto('/session-lock');
    await keeper.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('image-stitch-session');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('images', 'readwrite');
        const store = transaction.objectStore('images');
        let holding = true;
        window.releaseSessionLock = () => {
          holding = false;
          return new Promise((done) => {
            transaction.oncomplete = () => {
              db.close();
              done();
            };
          });
        };
        const keepAlive = () => {
          store.get('keep-alive').onsuccess = () => {
            if (holding) keepAlive();
            resolve();
          };
        };
        transaction.onerror = () => reject(transaction.error);
        keepAlive();
      };
    }));

    await page.reload();
    const thumbnails = page.locator('.thumb img');
    await uploadFiles(page, [fixture('screen-2.png')]);
    await expect(page.getByAltText(/screen-1\.png/)).toHaveCount(0);
    await keeper.evaluate(() => window.releaseSessionLock());
    await keeper.close();

    await expect(thumbnails.first()).toHaveAttribute('alt', /screen-1\.png/);
    await waitForResult(page);
    await waitForSessionSaved(page);
    await page.screenshot({ path: testInfo.outputPath('after-restore.png') });
    await expect(thumbnails.nth(1)).toHaveAttribute('alt', /screen-2\.png/);

    await page.keyboard.press('Control+z');
    await expect(thumbnails).toHaveCount(1);
    await expect(thumbnails.first()).toHaveAttribute('alt', /screen-1\.png/);
    await page.keyboard.press('Control+Shift+z');
    await expect(thumbnails.nth(1)).toHaveAttribute('alt', /screen-2\.png/);
    await waitForSessionSaved(page);
    await page.reload();
    await expect(thumbnails.nth(1)).toHaveAttribute('alt', /screen-2\.png/);
  });
});
