import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export const APP_URL = 'http://127.0.0.1:5199';
export const APP_ORIGIN = new URL(APP_URL).origin;

/** Absolute path of a fixture image in e2e/fixtures. */
export const fixture = (name) => path.join(fixturesDir, name);

/** Paths of screen-1..screen-N.png (all 500×1600). */
export const screenFixtures = (count) => (
  Array.from({ length: count }, (_, index) => fixture(`screen-${index + 1}.png`))
);

export const textFixture = {
  name: 'notes.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('this is not an image')
};

/**
 * Sprint A functional specs assert desktop UI contracts (settings panel,
 * downloads, layout geometry). The mobile project carries its own
 * mobile.spec.js viewport/sheet checks instead of re-running the same suite.
 */
export const runOnlyIn = (projectName) => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== projectName, `runs only in ${projectName}`);
  });
};

export const gotoApp = async (page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: '图片拼接助手' })).toBeVisible();
};

export const fileInput = (page) => page.locator('input[type="file"]');

export const uploadFiles = async (page, files) => {
  await fileInput(page).setInputFiles(files);
};

export const uploadScreens = async (page, count) => {
  await uploadFiles(page, screenFixtures(count));
  await expect(page.locator('.thumb')).toHaveCount(count);
};

/** Wait until the debounced render finished and a result image is on screen. */
export const waitForResult = async (page, timeout = 20_000) => {
  await expect(page.locator('img.result-image')).toBeVisible({ timeout });
  await expect(page.locator('.stage')).toHaveAttribute('aria-busy', 'false', { timeout });
};

export const resultSize = (page) => (
  page.locator('img.result-image').evaluate((image) => ({
    width: image.naturalWidth,
    height: image.naturalHeight
  }))
);

/** Poll the rendered result until it matches the expected natural size. */
export const expectResultSize = async (page, width, height) => {
  await waitForResult(page);
  await expect.poll(() => resultSize(page), { timeout: 20_000 }).toEqual({ width, height });
  await expect(page.locator('.output-meta')).toContainText(`${width} × ${height} px`);
};

export const outputMeta = (page) => page.locator('.output-meta');

export const directionGroup = (page) => page.getByRole('group', { name: '拼接方向' });

export const chooseDirection = async (page, label) => {
  await directionGroup(page).getByRole('button', { name: label, exact: true }).click();
  await expect(directionGroup(page).getByRole('button', { name: label, exact: true }))
    .toHaveAttribute('aria-pressed', 'true');
};

export const formatGroup = (page) => page.getByRole('group', { name: '格式' });

/** Open the settings disclosure (idempotent) via its summary trigger. */
export const openSettings = async (page) => {
  const details = page.locator('details.advanced');
  if (!(await details.evaluate((element) => element.open))) {
    await details.locator('summary.advanced-trigger').click();
  }
  await expect(details).toHaveAttribute('open', '');
};

export const closeSettings = async (page) => {
  const details = page.locator('details.advanced');
  if (await details.evaluate((element) => element.open)) {
    await details.locator('summary.advanced-trigger').click();
  }
  await expect(details).not.toHaveAttribute('open', '');
};

export const selectFormat = async (page, label) => {
  await openSettings(page);
  await formatGroup(page).getByRole('button', { name: label, exact: true }).click();
  await expect(page.getByRole('button', { name: `下载 ${label}` })).toBeVisible({ timeout: 20_000 });
};

/**
 * Drive a range input with the keyboard: range thumbs move by `step` per arrow
 * press, which is closer to a real user than assigning `.value` (React's value
 * tracker swallows programmatic writes).
 */
export const setRangeWithKeyboard = async (page, label, presses, key = 'ArrowRight') => {
  const slider = page.getByLabel(label);
  await slider.focus();
  for (let press = 0; press < presses; press += 1) {
    await slider.press(key);
  }
  return slider;
};

/**
 * Wait until the local session has actually flushed to IndexedDB. The status
 * pill says 已保存到本机 only after a debounced write (images ~500 ms,
 * settings ~350 ms), but it can still show a stale "saved" from the previous
 * change, so wait out one full debounce window and require it to still be
 * saved afterwards.
 */
export const waitForSessionSaved = async (page) => {
  const status = page.getByTestId('session-status');
  await expect(status).toHaveText('已保存到本机', { timeout: 20_000 });
  await page.waitForTimeout(700);
  await expect(status).toHaveText('已保存到本机', { timeout: 20_000 });
};
