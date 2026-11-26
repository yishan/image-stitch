import { expect, test } from '@playwright/test';
import { gotoApp, runOnlyIn, uploadScreens, waitForResult } from './helpers/app.js';

test.describe('Mask action messages', () => {
  runOnlyIn('desktop-chromium');

  test('show one mask instruction and keep export feedback neutral and localized', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'English' }).click();
    await uploadScreens(page, 2);
    await waitForResult(page);

    await page.getByRole('button', { name: 'Mask', exact: true }).click();
    const hint = page.locator('.redaction-toolbar__hint');
    const actionMessage = page.locator('.action-message');
    await expect(hint).toHaveText('Drag on the result to select masking areas');
    await expect.soft(actionMessage).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download PDF', exact: true }).click()
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await expect(actionMessage).toHaveText('Exported PDF');
    await expect.soft(actionMessage).toHaveCSS('color', await hint.evaluate((element) => getComputedStyle(element).color));

    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect.soft(actionMessage).toHaveText('已导出 PDF');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await expect(actionMessage).toHaveText('Exported PDF');
  });
});
