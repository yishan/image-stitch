import { expect, test } from '@playwright/test';
import {
  expectResultSize,
  gotoApp,
  openSettings,
  runOnlyIn,
  setRangeWithKeyboard,
  uploadScreens
} from './helpers/app.js';
import { downloadAndRead, pngSize } from './helpers/downloads.js';

test.describe('设置面板', () => {
  runOnlyIn('desktop-chromium');

  test('可通过 summary 开关，Escape 关闭并把焦点还给触发按钮', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 1);
    await expectResultSize(page, 500, 1600);

    const details = page.locator('details.advanced');
    const summary = details.locator('summary.advanced-trigger');

    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    await expect(page.getByRole('group', { name: '格式' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(details).not.toHaveAttribute('open', '');
    await expect(summary).toBeFocused();

    // Clicking outside the panel closes it as well. The panel overlays the top
    // of the stage, so click the footer privacy line instead.
    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    await page.getByText('图片只在本地处理，不会上传').click();
    await expect(details).not.toHaveAttribute('open', '');
  });

  test('外边距 24 + 图片间距 16 会改变输出尺寸与下载尺寸', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);
    await expectResultSize(page, 500, 4800);

    await openSettings(page);

    // Range step is 4: 6 presses = 24 px margin, 4 presses = 16 px gap.
    const margin = await setRangeWithKeyboard(page, '外边距', 6);
    await expect(margin).toHaveValue('24');
    const gap = await setRangeWithKeyboard(page, '图片间距', 4);
    await expect(gap).toHaveValue('16');

    // 500 + 2×24 wide; 3×1600 + 2×16 gap + 2×24 margin tall.
    await expectResultSize(page, 548, 4880);

    const file = await downloadAndRead(page, '下载 PNG');
    expect(pngSize(file.bytes)).toEqual({ width: 548, height: 4880 });
  });

  test('撤销自定义长边后同步输入框，未更改时失焦不会覆盖撤销', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);
    await openSettings(page);
    await page.getByLabel('尺寸', { exact: true }).selectOption('custom');

    const edge = page.getByRole('spinbutton', { name: '自定义长边' });
    await expect(edge).toHaveValue('4096');
    await edge.fill('2048');
    await edge.blur();
    await expectResultSize(page, 320, 2048);

    await page.keyboard.press('Control+z');
    await expectResultSize(page, 500, 3200);
    await expect(edge).toHaveValue('4096');

    await edge.focus();
    await edge.blur();
    await expectResultSize(page, 500, 3200);

    await page.keyboard.press('Control+Shift+z');
    await expectResultSize(page, 320, 2048);
    await expect(edge).toHaveValue('2048');
  });
});
