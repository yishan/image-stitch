import test from 'node:test';
import assert from 'node:assert/strict';

const loadCache = async () => {
    const mod = await import('./renderCache.js');
    return mod.createRenderCache;
};

const makeImage = (width, height) => ({ width, height, closed: false });
const bounds = (sourceWidth, sourceHeight, budget) => {
    const scale = Math.min(1, Math.sqrt(budget / (sourceWidth * sourceHeight)));
    return {
        width: Math.max(1, Math.floor(sourceWidth * scale)),
        height: Math.max(1, Math.floor(sourceHeight * scale))
    };
};

test('cache reuses a decoded entry for the same image identity', async () => {
    const createRenderCache = await loadCache();
    let decodes = 0;
    const cache = createRenderCache({
        bounds,
        resize: (image) => image,
        release: () => {}
    });

    const decode = async () => {
        decodes += 1;
        return { image: makeImage(100, 100), sourceWidth: 100, sourceHeight: 100 };
    };

    const first = await cache.get('image-a', 10_000, decode);
    const second = await cache.get('image-a', 10_000, decode);

    assert.equal(decodes, 1);
    assert.equal(first, second);
    assert.deepEqual(cache.stats, { size: 1, created: 1 });
});

test('a smaller budget reuses and downscales the cached bitmap without re-decoding', async () => {
    const createRenderCache = await loadCache();
    let decodes = 0;
    const resized = [];
    const cache = createRenderCache({
        bounds,
        resize: async (image, target) => {
            resized.push(target);
            return makeImage(target.width, target.height);
        },
        release: () => {}
    });

    const decode = async () => {
        decodes += 1;
        return { image: makeImage(100, 100), sourceWidth: 100, sourceHeight: 100 };
    };

    const large = await cache.get('image-a', 10_000, decode);
    const small = await cache.get('image-a', 2_500, decode);

    assert.equal(decodes, 1);
    assert.deepEqual([large.width, large.height], [100, 100]);
    assert.deepEqual([small.width, small.height], [50, 50]);
    assert.equal(resized.length, 1);
    assert.equal(cache.stats.created, 1);
});

test('a larger budget re-decodes a bitmap that was downscaled below the new target', async () => {
    const createRenderCache = await loadCache();
    let decodes = 0;
    const released = [];
    let cachedImage = null;
    const cache = createRenderCache({
        bounds,
        resize: async (image, target) => makeImage(target.width, target.height),
        release: (image) => released.push(image)
    });

    const decode = async () => {
        decodes += 1;
        cachedImage = makeImage(100, 100);
        return { image: cachedImage, sourceWidth: 100, sourceHeight: 100 };
    };

    await cache.get('image-a', 2_500, decode); // decoded to 50x50
    await cache.get('image-a', 10_000, decode); // needs 100x100 again

    assert.equal(decodes, 2);
    assert.equal(cache.stats.created, 2);
    assert.equal(released.length, 2);
});

test('adding a sibling image (smaller budget) keeps the decoded count stable', async () => {
    const createRenderCache = await loadCache();
    let decodes = 0;
    const cache = createRenderCache({
        bounds,
        resize: async (image, target) => makeImage(target.width, target.height),
        release: () => {}
    });
    const decode = async () => {
        decodes += 1;
        return { image: makeImage(500, 1600), sourceWidth: 500, sourceHeight: 1600 };
    };

    // 3-image budget vs 4-image budget: the screenshots fit both, so no resize/decode.
    const three = await Promise.all([1, 2, 3].map((id) => cache.get(`image-${id}`, 6_333_333, decode)));
    const four = await Promise.all([1, 2, 3, 4].map((id) => cache.get(`image-${id}`, 4_750_000, decode)));

    assert.equal(decodes, 4);
    assert.equal(three[0], four[0]);
    assert.equal(cache.stats.created, 4);
});

test('pruning releases dropped entries and keeps active ones', async () => {
    const createRenderCache = await loadCache();
    const released = [];
    const cache = createRenderCache({
        bounds,
        resize: (image) => image,
        release: (image) => released.push(image)
    });

    await cache.get('active', 10_000, async () => ({ image: makeImage(10, 10), sourceWidth: 10, sourceHeight: 10 }));
    await cache.get('stale', 10_000, async () => ({ image: makeImage(20, 20), sourceWidth: 20, sourceHeight: 20 }));

    const removed = cache.prune(new Set(['active']));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(removed, 1);
    assert.deepEqual(released.map((image) => image.width), [20]);
    assert.equal(cache.stats.size, 1);
});

test('a failed decode is evicted so the next attempt can retry', async () => {
    const createRenderCache = await loadCache();
    let attempts = 0;
    const cache = createRenderCache({ bounds, resize: (image) => image });

    await assert.rejects(cache.get('broken', 10_000, async () => {
        attempts += 1;
        throw new Error('decode failed');
    }), /decode failed/);

    assert.equal(cache.stats.size, 0);

    const recovered = await cache.get('broken', 10_000, async () => {
        attempts += 1;
        return { image: makeImage(30, 30), sourceWidth: 30, sourceHeight: 30 };
    });

    assert.equal(attempts, 2);
    assert.equal(recovered.width, 30);
    assert.equal(cache.stats.created, 2);
});

test('clear releases every cached entry', async () => {
    const createRenderCache = await loadCache();
    const released = [];
    const cache = createRenderCache({
        bounds,
        resize: (image) => image,
        release: (image) => released.push(image)
    });

    await cache.get('a', 10_000, async () => ({ image: makeImage(1, 1), sourceWidth: 1, sourceHeight: 1 }));
    await cache.get('b', 10_000, async () => ({ image: makeImage(2, 2), sourceWidth: 2, sourceHeight: 2 }));
    cache.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(released.map((image) => image.width).sort(), [1, 2]);
    assert.equal(cache.stats.size, 0);
});
