import test from 'node:test';
import assert from 'node:assert/strict';

const loadCache = async () => {
    const mod = await import('./renderCache.js');
    return mod.createRenderCache;
};

test('render cache reuses a decoded entry for the same key', async () => {
    const createRenderCache = await loadCache();
    let factoryCalls = 0;
    const cache = createRenderCache();

    const value = { bitmap: true };
    const first = await cache.get('a', async () => {
        factoryCalls += 1;
        return value;
    });
    const second = await cache.get('a', async () => {
        factoryCalls += 1;
        return value;
    });

    assert.equal(factoryCalls, 1);
    assert.equal(first, value);
    assert.equal(second, value);
    assert.equal(cache.stats.created, 1);
    assert.equal(cache.stats.size, 1);
});

test('pruning releases dropped entries and keeps active ones', async () => {
    const createRenderCache = await loadCache();
    const released = [];
    const cache = createRenderCache({ release: (value) => released.push(value) });

    await cache.get('active', async () => 'active-bitmap');
    await cache.get('stale', async () => 'stale-bitmap');

    const removed = cache.prune(new Set(['active']));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(removed, 1);
    assert.deepEqual(released, ['stale-bitmap']);
    assert.equal(cache.stats.size, 1);
});

test('a failed decode is evicted so the next attempt can retry', async () => {
    const createRenderCache = await loadCache();
    let attempts = 0;
    const cache = createRenderCache();

    await assert.rejects(cache.get('broken', async () => {
        attempts += 1;
        throw new Error('decode failed');
    }), /decode failed/);

    assert.equal(cache.stats.size, 0);

    const recovered = await cache.get('broken', async () => {
        attempts += 1;
        return 'bitmap';
    });

    assert.equal(attempts, 2);
    assert.equal(recovered, 'bitmap');
    assert.equal(cache.stats.created, 2);
});

test('clear releases every cached entry', async () => {
    const createRenderCache = await loadCache();
    const released = [];
    const cache = createRenderCache({ release: (value) => released.push(value) });

    await cache.get('a', async () => 'a');
    await cache.get('b', async () => 'b');
    cache.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(released.sort(), ['a', 'b']);
    assert.equal(cache.stats.size, 0);
});
