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

test('ordered session metadata takes precedence over legacy indices and transforms', () => {
    const a = { ...record('a', 0), transform: { rotate: 90 } };
    const b = record('b', 1);
    const images = normalizeStoredImages([a, b], [
        { id: 'b', transform: { rotate: 180 } },
        { id: 'a', transform: { rotate: 0 } }
    ]);

    assert.deepEqual(images.map(({ id, index, transform }) => [id, index, transform.rotate]), [['b', 0, 180], ['a', 1, 0]]);
    assert.equal(images[0].blob, b.blob);
    assert.equal(images[1].blob, a.blob);
});

test('diff saves preserve unchanged rows, order and transforms, and recover after failure', async (t) => {
    const rows = new Map();
    const settings = new Map();
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
                        const pendingSettings = new Map(settings);
                        const transaction = {
                            objectStore(name) {
                                const target = name === 'images' ? pending : pendingSettings;
                                return {
                                    clear() { if (name === 'images') operations.push('clear'); target.clear(); },
                                    put(row) { if (name === 'images') operations.push(`put:${row.id}`); target.set(row.id, row); },
                                    delete(id) { operations.push(`delete:${id}`); pending.delete(id); },
                                    getAll() {
                                        const result = {};
                                        queueMicrotask(() => { result.result = [...rows.values()]; result.onsuccess(); });
                                        return result;
                                    },
                                    get(key) {
                                        assert.equal(name, 'settings');
                                        const result = {};
                                        queueMicrotask(() => { result.result = target.get(key); result.onsuccess(); });
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
                                settings.clear();
                                pendingSettings.forEach((value, key) => settings.set(key, value));
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
        const rotating = rows.get('b');
        operations = [];
        const rotated = images.map((image) => image.id === 'b' ? { ...image, transform: { rotate: 90 } } : image);
        assert.equal(await saveSessionImages(rotated), true);
        assert.deepEqual(operations, []);
        assert.equal(rows.get('a'), untouched);
        assert.equal(rows.get('b'), rotating);
        assert.equal(settings.get('image-revision').order[1].transform.rotate, 90);
        operations = [];
        assert.equal(await saveSessionImages(rotated.slice(0, 2)), true);
        assert.deepEqual(operations, ['delete:c']);
        const restored = await loadSession();
        assert.deepEqual(restored.images.map(({ id, transform }) => [id, transform.rotate]), [['a', 0], ['b', 90]]);
        operations = [];
        fail = true;
        assert.equal(await saveSessionImages(images), false);
        assert.equal(settings.get('image-revision').order[1].transform.rotate, 90);
        operations = [];
        assert.equal(await saveSessionImages(images), true);
        assert.deepEqual(operations, ['clear', 'put:a', 'put:b', 'put:c']);
        settings.set('image-revision', { id: 'image-revision', value: 'another-tab', order: [{ id: 'unrelated' }] });
        rows.clear();
        rows.set('unrelated', record('unrelated', 0));
        operations = [];
        assert.equal(await saveSessionImages(rotated), true);
        assert.deepEqual(operations, ['clear', 'put:a', 'put:b', 'put:c']);
        assert.deepEqual([...rows.keys()], ['a', 'b', 'c']);
        assert.deepEqual(settings.get('image-revision').order.map(({ id, transform }) => [id, transform.rotate]), [['a', 0], ['b', 90], ['c', 0]]);
        operations = [];
        assert.equal(await saveSessionImages([]), true);
        assert.deepEqual(operations, ['delete:a', 'delete:b', 'delete:c']);
        assert.equal(await loadSession(), null);
        await Promise.all([saveSessionImages(images), clearSession()]);
        assert.equal(rows.size, 0);

        await t.test('the first reorder after loading reuses the saved blob rows', async () => {
            assert.equal(await saveSessionImages(rotated), true);
            const loaded = await loadSession();
            operations = [];
            assert.equal(await saveSessionImages([...loaded.images].reverse()), true);
            assert.deepEqual(operations, []);
            const reordered = await loadSession();
            assert.deepEqual(reordered.images.map(({ id, transform }) => [id, transform.rotate]), [['c', 0], ['b', 90], ['a', 0]]);
        });
    } finally {
        globalThis.indexedDB = original;
    }
});
