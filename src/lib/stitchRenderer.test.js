import test from 'node:test';
import assert from 'node:assert/strict';

const loadRendererModule = async () => {
    const renderer = await import('./stitchRenderer.js').catch(() => ({}));

    assert.equal(
        typeof renderer.getOutputScale,
        'function',
        'getOutputScale should be exported'
    );

    return renderer;
};

test('output scale enforces both pixel and edge limits', async () => {
    const { getOutputScale } = await loadRendererModule();

    const scale = getOutputScale(9072, 8064, {
        maxEdge: 8192,
        maxPixels: 20_000_000
    });

    assert.ok(scale < 1);
    assert.ok(9072 * scale <= 8192);
    assert.ok(9072 * 8064 * scale * scale <= 20_000_000);
});

test('output scale never enlarges a safe image', async () => {
    const { getOutputScale } = await loadRendererModule();

    assert.equal(getOutputScale(800, 600), 1);
});

test('source image dimensions stay within the allocated decode budget', async () => {
    const { getBoundedImageDimensions } = await loadRendererModule();

    assert.equal(typeof getBoundedImageDimensions, 'function', 'getBoundedImageDimensions should be exported');

    const dimensions = getBoundedImageDimensions(3024, 4032, 3_000_000);

    assert.ok(dimensions.width * dimensions.height <= 3_000_000);
    assert.ok(dimensions.width < 3024);
    assert.ok(dimensions.height < 4032);
});
