import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SESSION_IMAGES, normalizeStoredImages, saveSessionImages, loadSession, clearSession } from './sessionStore.js';

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

test('diff saves preserve unchanged rows, order and transforms, and recover after failure', async () => {
    const rows = new Map();
    let operations = [];
    let fail = false;
    const original = globalThis.indexedDB;
    globalThis.indexedDB = {
        open() {
            const request = {};
            queueMicrotask(() => {
                request.result = {
                    close() {},
                    transaction(_, mode) {
                        const pending = new Map(rows);
                        const transaction = {
                            objectStore(name) {
                                return {
                                    clear() { operations.push('clear'); pending.clear(); },
                                    put(row) { operations.push(`put:${row.id}`); pending.set(row.id, row); },
                                    delete(id) { operations.push(`delete:${id}`); pending.delete(id); },
                                    getAll() {
                                        const result = {};
                                        queueMicrotask(() => { result.result = [...rows.values()]; result.onsuccess(); });
                                        return result;
                                    },
                                    get() {
                                        assert.equal(name, 'settings');
                                        const result = {};
                                        queueMicrotask(() => { result.result = undefined; result.onsuccess(); });
                                        return result;
                                    }
                                };
                            }
                        };
                        globalThis.setImmediate(() => {
                            if (mode !== 'readwrite') return;
                            if (fail) {
                                fail = false;
                                transaction.onabort?.();
                            } else {
                                rows.clear();
                                pending.forEach((value, key) => rows.set(key, value));
                                transaction.oncomplete?.();
                            }
                        });
                        return transaction;
                    }
                };
                request.onsuccess();
            });
            return request;
        }
    };
    try {
        await clearSession();
        const images = ['a', 'b', 'c'].map((id) => ({ id, file: new Blob([id]), transform: {} }));
        assert.equal(await saveSessionImages(images), true);
        assert.ok(operations.includes('clear'));
        const untouched = rows.get('a');
        operations = [];
        const rotated = images.map((image) => image.id === 'b' ? { ...image, transform: { rotate: 90 } } : image);
        assert.equal(await saveSessionImages(rotated), true);
        assert.deepEqual(operations, ['put:b']);
        assert.equal(rows.get('a'), untouched);
        operations = [];
        assert.equal(await saveSessionImages(rotated.slice(0, 2)), true);
        assert.deepEqual(operations, ['delete:c']);
        const restored = await loadSession();
        assert.deepEqual(restored.images.map(({ id, transform }) => [id, transform.rotate]), [['a', 0], ['b', 90]]);
        operations = [];
        fail = true;
        assert.equal(await saveSessionImages(images), false);
        assert.equal(rows.get('b').transform.rotate, 90);
        operations = [];
        assert.equal(await saveSessionImages(images), true);
        assert.deepEqual(operations, ['clear', 'put:a', 'put:b', 'put:c']);
        operations = [];
        assert.equal(await saveSessionImages([]), true);
        assert.deepEqual(operations, ['delete:a', 'delete:b', 'delete:c']);
        assert.equal(await loadSession(), null);
        await Promise.all([saveSessionImages(images), clearSession()]);
        assert.equal(rows.size, 0);
    } finally {
        globalThis.indexedDB = original;
    }
});
