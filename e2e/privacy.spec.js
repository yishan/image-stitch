import { expect, test } from '@playwright/test';
import {
  APP_ORIGIN,
  expectResultSize,
  gotoApp,
  runOnlyIn,
  uploadScreens
} from './helpers/app.js';
import { downloadAndRead } from './helpers/downloads.js';

const isAllowedRequest = (url) => {
  if (url.startsWith('data:') || url.startsWith('blob:')) return true;
  if (!/^https?:/i.test(url)) return true;
  return new URL(url).origin === APP_ORIGIN;
};

test.describe('隐私：不上传', () => {
  runOnlyIn('desktop-chromium');

  test('上传、拼接、导出全程没有离开本机的请求', async ({ page }) => {
    const externalRequests = [];
    page.on('request', (request) => {
      if (!isAllowedRequest(request.url())) externalRequests.push(request.url());
    });
    page.on('requestfailed', (request) => {
      if (!isAllowedRequest(request.url())) externalRequests.push(`FAILED ${request.url()}`);
    });

    await gotoApp(page);
    await uploadScreens(page, 3);
    await expectResultSize(page, 500, 4800);

    const file = await downloadAndRead(page, '下载 PNG');
    expect(file.bytes.length).toBeGreaterThan(0);

    expect(externalRequests).toEqual([]);
  });
});
