import test from 'node:test';
import assert from 'node:assert/strict';

const loadLayoutModule = async () => {
    const layout = await import('./stitchLayout.js').catch(() => ({}));

    assert.equal(
        typeof layout.createStitchPlan,
        'function',
        'createStitchPlan should be exported'
    );

    return layout;
};

test('direct stitch mode places vertical images edge to edge without wave seams', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = [
        { width: 100, height: 50 },
        { width: 50, height: 50 }
    ];

    const plan = createStitchPlan(images, { direction: 'vertical', showWave: false });

    assert.equal(plan.totalWidth, 100);
    assert.equal(plan.totalHeight, 150);
    assert.equal(plan.seamShadows.length, 0);
    assert.deepEqual(
        plan.placements.map(({ x, y, width, height, topEdge, rightEdge, bottomEdge, leftEdge }) => ({
            x,
            y,
            width,
            height,
            hasWaveEdge: Boolean(topEdge || rightEdge || bottomEdge || leftEdge)
        })),
        [
            { x: 0, y: 0, width: 100, height: 50, hasWaveEdge: false },
            { x: 0, y: 50, width: 100, height: 100, hasWaveEdge: false }
        ]
    );
});

test('wave stitch mode remains the default', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = [
        { width: 100, height: 50 },
        { width: 100, height: 50 }
    ];

    const plan = createStitchPlan(images, { direction: 'vertical' });

    assert.equal(plan.seamShadows.length, 1);
    assert.ok(plan.placements[0].bottomEdge);
    assert.ok(plan.placements[1].topEdge);
});

test('wave metrics stay compact and dense across image resolutions', async () => {
    const { getRippleMetrics } = await loadLayoutModule();

    const small = getRippleMetrics(480, 320);
    const large = getRippleMetrics(3600, 2400);

    assert.ok(small.amplitude <= 5, 'small images should keep a low wave height');
    assert.ok(small.wavelength <= 28, 'small images should keep close wave spacing');
    assert.ok(large.amplitude <= 6, 'large images should not scale to bulky waves');
    assert.ok(large.wavelength <= 32, 'large images should not scale to sparse waves');
});

test('seam stroke metrics keep the divider visually thin', async () => {
    const { getSeamStrokeMetrics } = await loadLayoutModule();

    assert.equal(typeof getSeamStrokeMetrics, 'function');

    const metrics = getSeamStrokeMetrics(3600, 2400);

    assert.ok(metrics.lineWidth <= 1.5, 'seam stroke should stay thin on large images');
    assert.ok(metrics.offset <= 1.2, 'shadow offset should not make the divider look wide');
});
