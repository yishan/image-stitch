import { expect, test } from '@playwright/test';
import {
  fixture,
  gotoApp,
  outputMeta,
  runOnlyIn,
  uploadFiles
} from './helpers/app.js';

test.describe('错误路径', () => {
  runOnlyIn('desktop-chromium');

  test('极端宽高比图片给出宽高比错误并可重试', async ({ page }) => {
    await gotoApp(page);
    await uploadFiles(page, [fixture('extreme-1200x25.png')]);

    // The file is accepted by intake (it is an image) but rejected by render.
    await expect(page.locator('.thumb')).toHaveCount(1);

    const alert = page.getByRole('alert');
    await expect(alert).toContainText('宽高比', { timeout: 20_000 });
    await expect(alert.getByRole('button', { name: '重试' })).toBeVisible();
    await expect(outputMeta(page)).toContainText('—');
    await expect(page.locator('img.result-image')).toHaveCount(0);

    // Retry re-runs the render and surfaces the same deterministic error.
    await alert.getByRole('button', { name: '重试' }).click();
    await expect(page.getByRole('alert')).toContainText('宽高比', { timeout: 20_000 });
  });
});
