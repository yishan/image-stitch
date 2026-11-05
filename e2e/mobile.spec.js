import { expect, test } from '@playwright/test';
import {
  chooseDirection,
  expectResultSize,
  gotoApp,
  openSettings,
  runOnlyIn,
  uploadScreens,
  waitForResult
} from './helpers/app.js';

test.describe('移动端（Pixel 7）', () => {
  runOnlyIn('mobile-chromium');

  test('上传后无横向溢出，设置抽屉与下载均可用', async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    await gotoApp(page);
    await uploadScreens(page, 3);
    await expectResultSize(page, 500, 4800);

    // The result preview must not widen the page.
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    const imageBox = await page.locator('img.result-image').boundingBox();
    expect(imageBox.width).toBeLessThanOrEqual(viewport.width);

    // Settings disclosure behaves as a bottom sheet on phones.
    await openSettings(page);
    const panel = page.locator('.advanced-panel');
    await expect(panel).toBeVisible();
    const panelBox = await panel.boundingBox();
    expect(panelBox.width).toBeLessThanOrEqual(viewport.width);
    expect(Math.abs(panelBox.y + panelBox.height - viewport.height)).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
      .toBeLessThanOrEqual(1);

    await page.keyboard.press('Escape');
    await expect(page.locator('details.advanced')).not.toHaveAttribute('open', '');

    // The primary download action is reachable and produces a PNG.
    const downloadPromise = page.waitForEvent('download');
    const downloadButton = page.getByRole('button', { name: '下载 PNG' });
    await downloadButton.scrollIntoViewIfNeeded();
    await expect(downloadButton).toBeEnabled();
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect(await download.failure()).toBeNull();
  });

  test('拖拽焦点不会劫持页面滚动', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await page.locator('.thumb-frame').first().click();
    await page.getByRole('group', { name: '填充方式' })
      .getByRole('button', { name: '填满' })
      .click();

    const editor = page.locator('.focus-editor');
    await expect(editor).toBeVisible();
    await editor.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    const box = await editor.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }]
    });
    for (let step = 1; step <= 8; step += 1) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + step * 10, id: 1 }]
      });
      await page.waitForTimeout(20);
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });

    await expect(page.locator('.focus-editor__focus-value')).not.toHaveText('50% / 50%');
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
    await waitForResult(page);
  });

  test('移动端也可以切换布局并重新拼接', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await page.getByRole('group', { name: '拼接方向' })
      .getByRole('button', { name: '横向', exact: true })
      .click();
    // Export geometry is viewport-independent: 2 × (500×1600) side by side.
    await expectResultSize(page, 1000, 1600);
  });
});
