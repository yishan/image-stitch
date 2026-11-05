import test from 'node:test';
import assert from 'node:assert/strict';
import en from './messages.en.js';
import zh from './messages.zh.js';
import { translate } from './translate.js';

const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === 'object' ? flatten(child, path) : [[path, child]];
});

const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('zh and en dictionaries expose the same keys and placeholders', () => {
    const zhKeys = flatten(zh).map(([key]) => key).sort();
    const enKeys = flatten(en).map(([key]) => key).sort();
    assert.deepEqual(enKeys, zhKeys);

    const enMap = Object.fromEntries(flatten(en));
    flatten(zh).forEach(([key, value]) => {
        assert.deepEqual(placeholders(enMap[key]), placeholders(value), `placeholders differ for ${key}`);
    });
});

test('translate interpolates params and falls back to zh', () => {
    assert.equal(translate('en', 'upload.hint', { max: 6 }), 'Drop images here, or click to choose (up to 6)');
    assert.equal(translate('zh', 'preview.small', { count: 2 }), '2 张图片分辨率偏小，将保持原始尺寸居中（不放大）');
    assert.equal(translate('en', 'missing.key'), 'missing.key');
});
