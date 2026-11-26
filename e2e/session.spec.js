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

const trackImageSaveBytes = (page) => page.addInitScript(() => {
  const put = IDBObjectStore.prototype.put;
  const bytes = new WeakMap();
  window.imageSaveBytes = [];
  IDBObjectStore.prototype.put = function (row, ...args) {
    if (this.name === 'images' && row.blob instanceof Blob) {
      bytes.set(this.transaction, (bytes.get(this.transaction) ?? 0) + row.blob.size);
    } else if (this.name === 'settings' && row.id === 'image-revision') {
      this.transaction.addEventListener('complete', () => {
        window.imageSaveBytes.push(bytes.get(this.transaction) ?? 0);
      });
    }
    return put.call(this, row, ...args);
  };
});

const moveFirstThumbnailRight = async (page) => {
  await page.locator('.thumb-grip').first().focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.thumb').first()).toHaveClass(/is-dragging/);
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('status').filter({ hasText: '第 1 张图片位于第 2 张图片附近。' })).toBeAttached();
  await page.keyboard.press('Space');
};

const dragFirstThumbnailOntoSecond = async (page) => {
  const grip = await page.locator('.thumb-grip').first().boundingBox();
  const target = await page.locator('.thumb').nth(1).boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await expect(page.getByRole('status').filter({ hasText: '第 1 张图片位于第 2 张图片附近。' })).toBeAttached();
  await page.mouse.up();
};

const expectThumbnailOrder = async (page, names) => {
  const thumbnails = page.locator('.thumb img');
  await expect(thumbnails).toHaveCount(names.length);
  for (const [index, name] of names.entries()) {
    await expect(thumbnails.nth(index)).toHaveAttribute('alt', `第 ${index + 1} 张图片：${name}`);
  }
};

test.describe('Session recovery', () => {
  runOnlyIn('desktop-chromium');

  test('persists reorder, undo and redo without putting image blobs, including after reload', async ({ page }) => {
    const originalOrder = ['screen-1.png', 'screen-2.png'];
    const reversedOrder = [...originalOrder].reverse();
    const savedBytes = () => page.evaluate(() => window.imageSaveBytes);
    await trackImageSaveBytes(page);
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expect.poll(async () => (await savedBytes())[0]).toBeGreaterThan(0);

    await moveFirstThumbnailRight(page);
    await expectThumbnailOrder(page, reversedOrder);
    await expect.poll(async () => (await savedBytes()).slice(1)).toEqual([0]);
    await page.keyboard.press('Control+z');
    await expectThumbnailOrder(page, originalOrder);
    await expect.poll(async () => (await savedBytes()).slice(1)).toEqual([0, 0]);
    await page.keyboard.press('Control+Shift+z');
    await expectThumbnailOrder(page, reversedOrder);
    await expect.poll(async () => (await savedBytes()).slice(1)).toEqual([0, 0, 0]);

    await page.reload();
    await expectThumbnailOrder(page, reversedOrder);
    await moveFirstThumbnailRight(page);
    await expectThumbnailOrder(page, originalOrder);
    await expect.poll(savedBytes).toEqual([0]);
  });

  test('restores legacy session order and transforms and persists its first reorder without blob puts', async ({ page }) => {
    await trackImageSaveBytes(page);
    await page.route('**/legacy-session', (route) => route.fulfill({ contentType: 'text/html', body: '' }));
    await page.goto('/legacy-session');
    await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      const blob = await new Promise((resolve) => canvas.toBlob(resolve));
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('image-stitch-session', 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('images', { keyPath: 'id' });
          request.result.createObjectStore('settings', { keyPath: 'id' });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['images', 'settings'], 'readwrite');
          const store = transaction.objectStore('images');
          store.put({ id: 'a', index: 1, name: 'a.png', type: 'image/png', lastModified: 1, blob });
          store.put({ id: 'b', index: 0, name: 'b.png', type: 'image/png', lastModified: 1, blob, transform: { rotate: 90 } });
          transaction.objectStore('settings').put({ id: 'image-revision', value: 'legacy' });
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onabort = () => reject(transaction.error);
        };
      });
    });

    await gotoApp(page);
    await expectThumbnailOrder(page, ['b.png', 'a.png']);
    const rotated = page.getByAltText(/b\.png/);
    await expect(rotated).toHaveAttribute('style', /rotate\(90deg\)/);
    await dragFirstThumbnailOntoSecond(page);
    await expectThumbnailOrder(page, ['a.png', 'b.png']);
    await expect.poll(() => page.evaluate(() => window.imageSaveBytes)).toEqual([0]);
    await page.reload();
    await expectThumbnailOrder(page, ['a.png', 'b.png']);
    await expect(rotated).toHaveAttribute('style', /rotate\(90deg\)/);
  });

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
