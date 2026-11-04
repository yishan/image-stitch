import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SESSION_IMAGES, normalizeStoredImages } from './sessionStore.js';

const record = (id, index, blob = { size: 1 }) => ({
    id,
    index,
    name: `${id}.png`,
    type: 'image/png',
    lastModified: 1,
    blob
});

test('stored session images keep their saved order and index', () => {
    const images = normalizeStoredImages([record('b', 2), record('a', 0), record('c', 1)]);

    assert.deepEqual(images.map((image) => image.id), ['a', 'c', 'b']);
    assert.deepEqual(images.map((image) => image.index), [0, 1, 2]);
    assert.equal(images[0].name, 'a.png');
});

test('stored session images drop invalid records and cap the count', () => {
    const records = [
        record('a', 0),
        { id: 'no-blob', index: 1 },
        null,
        record('b', 2, null),
        ...Array.from({ length: 8 }, (_, index) => record(`extra-${index}`, index + 3))
    ];
    const images = normalizeStoredImages(records);

    assert.equal(images.length, MAX_SESSION_IMAGES);
    assert.deepEqual(images.map((image) => image.id), ['a', ...Array.from({ length: 5 }, (_, index) => `extra-${index}`)]);
    assert.ok(images.every((image) => image.blob));
});

test('stored session images handle a missing collection', () => {
    assert.deepEqual(normalizeStoredImages(undefined), []);
    assert.deepEqual(normalizeStoredImages(null), []);
    assert.deepEqual(normalizeStoredImages({}), []);
});
