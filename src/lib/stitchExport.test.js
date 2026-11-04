import test from 'node:test';
import assert from 'node:assert/strict';

const loadRenderer = async () => {
    const renderer = await import('./stitchRenderer.js').catch(() => ({}));

    assert.equal(
        typeof renderer.getExportDimensions,
        'function',
        'getExportDimensions should be exported'
    );

    return renderer;
};

test('long-image mode keeps phone screenshots at their native width', async () => {
    const { getExportDimensions } = await loadRenderer();

    const dimensions = getExportDimensions(1179, 15336, { sizeMode: 'long' });

    assert.equal(dimensions.scale, 1);
    assert.equal(dimensions.width, 1179);
    assert.equal(dimensions.height, 15336);
    assert.equal(dimensions.scaled, false);
});

test('default size mode still protects the 8192px edge', async () => {
    const { getExportDimensions } = await loadRenderer();

    const dimensions = getExportDimensions(1179, 15336, { sizeMode: 'auto' });

    assert.ok(Math.max(dimensions.width, dimensions.height) <= 8192);
    assert.ok(dimensions.width < 1179);
    assert.equal(dimensions.scaled, true);
});

test('long-image mode still respects the 20 megapixel budget', async () => {
    const { getExportDimensions } = await loadRenderer();

    const dimensions = getExportDimensions(4000, 8000, { sizeMode: 'long' });

    assert.ok(dimensions.width * dimensions.height <= 20_000_000);
    assert.ok(dimensions.width * dimensions.height > 19_000_000);
});

test('edge preset caps the longest side', async () => {
    const { getExportDimensions } = await loadRenderer();

    const dimensions = getExportDimensions(4000, 8000, { sizeMode: 'edge4096' });

    assert.equal(Math.max(dimensions.width, dimensions.height), 4096);
    assert.equal(dimensions.width, 2048);
});

test('width preset targets 1080px without upscaling', async () => {
    const { getExportDimensions } = await loadRenderer();

    const large = getExportDimensions(1179, 4800, { sizeMode: 'width1080' });
    const small = getExportDimensions(500, 800, { sizeMode: 'width1080' });

    assert.equal(large.width, 1080);
    assert.equal(small.width, 500);
    assert.equal(small.scale, 1);
});

test('custom edge is clamped to the supported range', async () => {
    const { getExportDimensions } = await loadRenderer();

    const tiny = getExportDimensions(1000, 2000, { sizeMode: 'custom', customEdge: 100 });
    const huge = getExportDimensions(4000, 8000, { sizeMode: 'custom', customEdge: 999999 });

    assert.equal(Math.max(tiny.width, tiny.height), 512);
    assert.ok(Math.max(huge.width, huge.height) <= 16384);
});

test('a device maxPixels override keeps long images inside the safe budget', async () => {
    const { getExportDimensions } = await loadRenderer();

    const dimensions = getExportDimensions(1179, 15336, { sizeMode: 'long' }, { maxPixels: 16_000_000 });

    assert.equal(dimensions.binding, 'pixels');
    assert.ok(dimensions.width * dimensions.height <= 16_000_000);
    assert.ok(dimensions.width < 1179);
    assert.ok(dimensions.width > 1000);
});

test('binding reports which cap actually limited the output', async () => {
    const { getExportDimensions } = await loadRenderer();

    // Width preset requested, but the 8192 edge cap binds first.
    const edgeBound = getExportDimensions(1179, 15336, { sizeMode: 'width1080' });
    assert.equal(edgeBound.binding, 'edge');
    assert.ok(edgeBound.width < 1080);

    // Width preset binds.
    const widthBound = getExportDimensions(1179, 1000, { sizeMode: 'width1080' });
    assert.equal(widthBound.binding, 'width');
    assert.equal(widthBound.width, 1080);
});

test('canvas area probe is a no-op outside the browser', async () => {
    const { canRenderCanvasArea, getSafeMaxPixels, DEFAULT_OUTPUT_LIMITS } = await loadRenderer();

    assert.equal(canRenderCanvasArea(20_000_000), true);
    assert.equal(getSafeMaxPixels(20_000_000), DEFAULT_OUTPUT_LIMITS.maxPixels);
});

test('export formats map to canvas mime types and extensions', async () => {
    const { getExportFormat } = await loadRenderer();

    assert.deepEqual(getExportFormat('png'), { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', lossy: false });
    assert.equal(getExportFormat('jpeg').mime, 'image/jpeg');
    assert.equal(getExportFormat('jpeg').ext, 'jpg');
    assert.equal(getExportFormat('jpeg').lossy, true);
    assert.equal(getExportFormat('webp').mime, 'image/webp');
    assert.equal(getExportFormat('nope').id, 'png');
});

test('source decode budget fits six native iPhone screenshots', async () => {
    const { DEFAULT_SOURCE_LIMITS } = await loadRenderer();

    assert.ok(
        DEFAULT_SOURCE_LIMITS.maxTotalPixels >= 6 * 1179 * 2556,
        'long-image mode needs the full 18.08 MP source budget to keep native width'
    );
});

test('background colours resolve to canvas-safe fills', async () => {
    const { isTransparentColor, resolveBackground } = await loadRenderer();

    assert.equal(resolveBackground('transparent'), 'rgba(0, 0, 0, 0)');
    assert.equal(resolveBackground('paper'), '#f6f3ed');
    assert.equal(resolveBackground('ink'), '#201c17');
    assert.equal(resolveBackground('#123abc'), '#123abc');
    assert.equal(resolveBackground('not-a-colour'), 'rgba(0, 0, 0, 0)');
    assert.equal(isTransparentColor('rgba(0, 0, 0, 0)'), true);
    assert.equal(isTransparentColor('#ffffff'), false);
});
