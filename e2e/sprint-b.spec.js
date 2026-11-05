import { expect, test } from '@playwright/test';
import {
  chooseDirection,
  expectResultSize,
  fixture,
  gotoApp,
  runOnlyIn,
  uploadFiles,
  uploadScreens,
  waitForResult,
  waitForSessionSaved
} from './helpers/app.js';

const selectThumb = async (page, index) => {
  await page.locator('.thumb-frame').nth(index).click();
  await expect(page.locator('.thumb').nth(index)).toHaveAttribute('aria-current', 'true');
};

const fitGroup = (page) => page.getByRole('group', { name: '填充方式' });

test.describe('Sprint B · 每图旋转/翻转/填充', () => {
  runOnlyIn('desktop-chromium');

  test('旋转 90° 改变画布宽高，翻转与重置回到原始尺寸', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await selectThumb(page, 0);
    await page.getByRole('button', { name: '旋转 90°' }).click();
    await expectResultSize(page, 1600, 2100);

    await page.getByRole('button', { name: '水平翻转' }).click();
    await expect(page.getByRole('button', { name: '水平翻转' })).toHaveAttribute('aria-pressed', 'true');
    await expectResultSize(page, 1600, 2100);

    await page.getByRole('button', { name: '重置', exact: true }).click();
    await expectResultSize(page, 500, 3200);
    await expect(page.getByRole('button', { name: '水平翻转' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('撤销可以撤销单图旋转', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await selectThumb(page, 0);
    await page.getByRole('button', { name: '旋转 90°' }).click();
    await expectResultSize(page, 1600, 2100);

    await page.keyboard.press('Control+z');
    await expectResultSize(page, 500, 3200);
    await page.keyboard.press('Control+Shift+z');
    await expectResultSize(page, 1600, 2100);
  });

  test('翻转让窄图填满交叉轴，尺寸按比例放大', async ({ page }) => {
    await gotoApp(page);
    await uploadFiles(page, [fixture('small-600x900.png'), fixture('screen-1.png')]);
    await expect(page.locator('.thumb')).toHaveCount(2);
    await expectResultSize(page, 600, 2500);

    await selectThumb(page, 1);
    await fitGroup(page).getByRole('button', { name: '填满' }).click();
    await expectResultSize(page, 600, 2820);
  });

  test('单图旋转与填充随会话恢复', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 2);
    await expectResultSize(page, 500, 3200);

    await selectThumb(page, 0);
    await page.getByRole('button', { name: '旋转 90°' }).click();
    await expectResultSize(page, 1600, 2100);
    await waitForSessionSaved(page);

    await page.reload();
    await expect(page.locator('.thumb')).toHaveCount(2, { timeout: 20_000 });
    await waitForResult(page);
    await expectResultSize(page, 1600, 2100);
  });
});

test.describe('Sprint B · 网格预设', () => {
  runOnlyIn('desktop-chromium');

  test('2×2 网格输出固定单元格并禁用波浪接缝', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');

    const preset = page.getByLabel('网格布局');
    await expect(preset).toBeVisible();
    await expect(preset.locator('option')).toHaveCount(4);
    await preset.selectOption('2x2');

    await expectResultSize(page, 1000, 1000);
    await expect(page.locator('.seam input')).toBeDisabled();
    await expect(page.locator('.seam')).toHaveAttribute('title', '网格预设使用直边拼缝');
  });

  test('1+2 与 1+3 的主图/副图行列尺寸', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 3);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('1+2');
    await expectResultSize(page, 1000, 975);

    await page.locator('input[type="file"]').setInputFiles(fixture('screen-4.png'));
    await expect(page.locator('.thumb')).toHaveCount(4);
    await page.getByLabel('网格布局').selectOption('1+3');
    await expectResultSize(page, 1000, 850);
  });

  test('焦点会改变网格单元里实际裁切的区域', async ({ page }) => {
    await gotoApp(page);
    await uploadFiles(page, [fixture('left-right-wide.png')]);
    await expect(page.locator('.thumb')).toHaveCount(1);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');

    await selectThumb(page, 0);
    await fitGroup(page).getByRole('button', { name: '填满' }).click();
    const focus = page.getByLabel('焦点位置');

    const centrePixel = async () => {
      await page.waitForTimeout(450);
      await waitForResult(page);
      return page.locator('img.result-image').evaluate(async (image) => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return Array.from(context.getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1,
          1
        ).data).slice(0, 3);
      });
    };

    await focus.selectOption('左');
    expect(await centrePixel()).toEqual([214, 69, 65]);
    await focus.selectOption('右');
    expect(await centrePixel()).toEqual([47, 111, 237]);
  });

  test('网格布局控件与分段控件同高、固定宽度并使用自定义外观', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');

    const wrapper = page.locator('.grid-preset');
    const direction = page.locator('.stitch-toolbar > .segmented').first();
    const [wrapperBox, directionBox] = await Promise.all([
      wrapper.boundingBox(),
      direction.boundingBox()
    ]);

    expect(Math.round(wrapperBox.height)).toBe(Math.round(directionBox.height));
    await expect(page.getByLabel('网格布局')).toHaveCSS('appearance', 'none');

    const width = wrapperBox.width;
    await page.getByLabel('网格布局').selectOption('1+3');
    expect((await wrapper.boundingBox()).width).toBe(width);
  });

  test('网格单元的填满与焦点控件可见，焦点可切换', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');

    await selectThumb(page, 0);
    await fitGroup(page).getByRole('button', { name: '填满' }).click();

    const focus = page.getByLabel('焦点位置');
    await expect(focus).toBeVisible();
    await expect(focus).toHaveValue('居中');
    await focus.selectOption('右下');
    await expect(focus).toHaveValue('右下');
  });
});

test.describe('Sprint B · 拖拽焦点', () => {
  runOnlyIn('desktop-chromium');

  test('拖动焦点预览只产生一步撤销，并显示自定义焦点', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await selectThumb(page, 0);
    await fitGroup(page).getByRole('button', { name: '填满' }).click();

    const editor = page.locator('.focus-editor');
    const percent = page.locator('.focus-editor__focus-value');
    await expect(editor).toBeVisible();
    await expect(percent).toHaveText('50% / 50%');

    await editor.scrollIntoViewIfNeeded();
    const box = await editor.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, startY + box.height * 0.35, { steps: 8 });
    await page.mouse.up();

    await expect(percent).not.toHaveText('50% / 50%');
    await expect(page.getByLabel('焦点位置')).toHaveValue('custom');

    await page.keyboard.press('Control+z');
    await expect(percent).toHaveText('50% / 50%');
    await expect(page.getByLabel('焦点位置')).toHaveValue('居中');
  });

  test('方向键微调焦点并合并成一步历史', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await selectThumb(page, 0);
    await fitGroup(page).getByRole('button', { name: '填满' }).click();

    const editor = page.locator('.focus-editor');
    await editor.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');

    await expect(page.locator('.focus-editor__focus-value')).toHaveText('56% / 50%');
    await page.keyboard.press('Control+z');
    await expect(page.locator('.focus-editor__focus-value')).toHaveText('50% / 50%');
  });

  test('拖拽后的焦点随会话恢复', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await selectThumb(page, 0);
    await fitGroup(page).getByRole('button', { name: '填满' }).click();

    const editor = page.locator('.focus-editor');
    await editor.scrollIntoViewIfNeeded();
    const box = await editor.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.75, { steps: 8 });
    await page.mouse.up();

    const savedPercent = await page.locator('.focus-editor__focus-value').textContent();
    await waitForSessionSaved(page);
    await page.reload();
    await expect(page.locator('.thumb')).toHaveCount(4, { timeout: 20_000 });
    await waitForResult(page);
    await selectThumb(page, 0);

    await expect(page.locator('.focus-editor__focus-value')).toHaveText(savedPercent.trim());
    await expect(page.getByLabel('焦点位置')).toHaveValue('custom');
  });
});

test.describe('Sprint B · 焦点缩放', () => {
  runOnlyIn('desktop-chromium');

  test('缩放改变裁切预览但保持单元格尺寸，并随会话恢复', async ({ page }) => {
    await gotoApp(page);
    await uploadScreens(page, 4);
    await chooseDirection(page, '网格');
    await page.getByLabel('网格布局').selectOption('2x2');
    await selectThumb(page, 0);
    await fitGroup(page).getByRole('button', { name: '填满' }).click();

    const zoom = page.getByLabel('图片缩放');
    await expect(zoom).toBeVisible();
    await expect(zoom).toHaveValue('1');

    await zoom.evaluate((input) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '2');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect(page.locator('.focus-editor__zoom-value')).toHaveText('200%');
    await expectResultSize(page, 1000, 1000);

    await zoom.focus();
    await page.keyboard.press('Control+z');
    await expect(zoom).toHaveValue('1');
    await expect(page.locator('.focus-editor__zoom-value')).toHaveText('100%');
    await page.keyboard.press('Control+Shift+z');
    await expect(zoom).toHaveValue('2');
    await page.locator('body').click({ position: { x: 5, y: 5 } });

    await waitForSessionSaved(page);
    await page.reload();
    await expect(page.locator('.thumb')).toHaveCount(4, { timeout: 20_000 });
    await waitForResult(page);
    await selectThumb(page, 0);

    await expect(page.getByLabel('图片缩放')).toHaveValue('2');
    await expect(page.locator('.focus-editor__zoom-value')).toHaveText('200%');
  });
});
