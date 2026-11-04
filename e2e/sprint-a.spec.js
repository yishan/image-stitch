import { expect, test } from '@playwright/test';
import {
  chooseDirection,
  directionGroup,
  expectResultSize,
  gotoApp,
  openSettings,
  runOnlyIn,
  setRangeWithKeyboard,
  uploadScreens,
  waitForResult,
  waitForSessionSaved
} from './helpers/app.js';

test.describe('Sprint A · 会话恢复', () => {
  runOnlyIn('desktop-chromium');

  test('刷新后恢复图片与设置，清除本机会话后为空', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await chooseDirection(page, '横向');
    await openSettings(page);
    await waitForSessionSaved(page);

    await page.reload();
    await expect(page.locator('.thumb')).toHaveCount(2, { timeout: 20_000 });
    await expect(directionGroup(page).getByRole('button', { name: '横向', exact: true }))
      .toHaveAttribute('aria-pressed', 'true');

    // Clearing local data wipes the snapshot. StitchCanvas (and the status
    // element) unmounts, so assert the cleared state directly, then reload.
    await openSettings(page);
    await expect(page.getByTestId('session-status')).toHaveText('已保存到本机');
    await page.getByRole('button', { name: '清除本机会话' }).click();
    await expect(page.locator('.thumb')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('长图会出现在这里')).toBeVisible();

    await page.reload();
    await expect(page.locator('.thumb')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('长图会出现在这里')).toBeVisible();
  });
});

test.describe('Sprint A · 快捷键与撤销', () => {
  runOnlyIn('desktop-chromium');

  test('Control+Z 撤销上传，Control+Shift+Z 重做', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await page.keyboard.press('Control+z');
    await expect(page.locator('.thumb')).toHaveCount(0);

    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('.thumb')).toHaveCount(2);
    await expectResultSize(page, 500, 3200);
  });

  test('点击缩略图选中后 Delete 删除该图', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);

    const firstThumb = page.locator('.thumb').first();
    await firstThumb.locator('.thumb-frame').click();
    await expect(firstThumb).toHaveAttribute('aria-current', 'true');

    await page.keyboard.press('Delete');
    await expect(page.locator('.thumb')).toHaveCount(1);
    await expectResultSize(page, 500, 1600);
  });

  test('Control+S 在有结果时触发下载', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    const downloadPromise = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.png$/);
    expect(await download.failure()).toBeNull();
  });
});

test.describe('Sprint A · 长图预览适应', () => {
  runOnlyIn('desktop-chromium');

  test('适应宽度可纵向滚动细节，适应整图恢复，舞台高度不变', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 6);
    await waitForResult(page);

    const stage = page.locator('.stage');
    const fitWhole = page.getByRole('button', { name: '适应整图' });
    const fitWidth = page.getByRole('button', { name: '适应宽度' });
    await expect(fitWhole).toBeVisible();
    await expect(fitWidth).toBeVisible();
    await expect(stage).toHaveAttribute('data-preview-mode', 'fit');

    const heightBefore = (await stage.boundingBox()).height;

    await fitWidth.click();
    await expect(stage).toHaveAttribute('data-preview-mode', 'width');
    await expect(fitWidth).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => stage.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    const heightAfter = (await stage.boundingBox()).height;
    expect(Math.abs(heightAfter - heightBefore)).toBeLessThanOrEqual(1);

    await fitWhole.click();
    await expect(stage).toHaveAttribute('data-preview-mode', 'fit');
    await expect(fitWhole).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => stage.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });
});

test.describe('Sprint A · 设置记忆', () => {
  runOnlyIn('desktop-chromium');

  test('修改图片间距后刷新仍保留，恢复默认设置后归零且可撤销', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 1);
    await openSettings(page);

    const gap = await setRangeWithKeyboard(page, '图片间距', 4);
    await expect(gap).toHaveValue('16');
    await waitForSessionSaved(page);

    await page.reload();
    // The settings panel is rendered by StitchCanvas, so the restored session
    // must bring the image back before the panel exists again.
    await expect(page.locator('.thumb')).toHaveCount(1, { timeout: 20_000 });
    await openSettings(page);
    await expect(page.getByLabel('图片间距')).toHaveValue('16');

    await page.getByRole('button', { name: '恢复默认设置' }).click();
    await expect(page.getByLabel('图片间距')).toHaveValue('0');
    await expect(page.getByLabel('外边距')).toHaveValue('0');

    // The reset is undoable like any other settings change.
    await page.keyboard.press('Control+z');
    await expect(page.getByLabel('图片间距')).toHaveValue('16');
  });
});
