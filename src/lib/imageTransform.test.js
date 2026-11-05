import test from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_TRANSFORM,
    ensureImageTransforms,
    getRotatedDimensions,
    normalizeTransform,
    withImageTransform
} from './imageTransform.js';

test('normalizeTransform clamps and falls back to safe values', () => {
    assert.deepEqual(normalizeTransform(undefined), DEFAULT_TRANSFORM);
    assert.deepEqual(normalizeTransform({}), DEFAULT_TRANSFORM);

    const normalized = normalizeTransform({
        rotate: 135,
        flipX: 1,
        flipY: 0,
        fit: 'stretch',
        focusX: 2,
        focusY: -1
    });

    assert.equal(normalized.rotate, 0);
    assert.equal(normalized.flipX, true);
    assert.equal(normalized.flipY, false);
    assert.equal(normalized.fit, 'contain');
    assert.equal(normalized.focusX, 1);
    assert.equal(normalized.focusY, 0);
});

test('rotation swaps width and height for 90/270 only', () => {
    assert.deepEqual(getRotatedDimensions(500, 1600, 0), { width: 500, height: 1600 });
    assert.deepEqual(getRotatedDimensions(500, 1600, 90), { width: 1600, height: 500 });
    assert.deepEqual(getRotatedDimensions(500, 1600, 180), { width: 500, height: 1600 });
    assert.deepEqual(getRotatedDimensions(500, 1600, 270), { width: 1600, height: 500 });
});

test('withImageTransform only touches the matching image', () => {
    const images = [
        { id: 'a', transform: DEFAULT_TRANSFORM },
        { id: 'b', transform: DEFAULT_TRANSFORM }
    ];
    const next = withImageTransform(images, 'b', { rotate: 90, fit: 'cover' });

    assert.equal(next[0], images[0]);
    assert.deepEqual(next[1].transform, { ...DEFAULT_TRANSFORM, rotate: 90, fit: 'cover' });
});

test('ensureImageTransforms adds defaults without replacing existing ones', () => {
    const existing = { id: 'b', transform: { ...DEFAULT_TRANSFORM, rotate: 90 } };
    const images = ensureImageTransforms([{ id: 'a' }, existing]);

    assert.deepEqual(images[0].transform, DEFAULT_TRANSFORM);
    assert.equal(images[1], existing);
});

test('zoom defaults to 1 and clamps to the supported range', () => {
    assert.equal(normalizeTransform(undefined).zoom, 1);
    assert.equal(normalizeTransform({ zoom: 0.25 }).zoom, 1);
    assert.equal(normalizeTransform({ zoom: 2.5 }).zoom, 2.5);
    assert.equal(normalizeTransform({ zoom: 9 }).zoom, 3);
});
