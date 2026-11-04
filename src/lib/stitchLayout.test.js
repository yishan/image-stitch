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

test('direct stitch mode keeps each image at its original size and centres it', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = [
        { width: 100, height: 50 },
        { width: 50, height: 50 }
    ];

    const plan = createStitchPlan(images, { direction: 'vertical', showWave: false });

    assert.equal(plan.totalWidth, 100);
    assert.equal(plan.totalHeight, 100);
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
            { x: 25, y: 50, width: 50, height: 50, hasWaveEdge: false }
        ]
    );
});

test('small images are never upscaled to the widest image', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = [
        { width: 1200, height: 800 },
        { width: 600, height: 400 }
    ];

    const plan = createStitchPlan(images, { direction: 'vertical', showWave: false });

    assert.equal(plan.placements[0].width, 1200);
    assert.equal(plan.placements[1].width, 600);
    assert.equal(plan.placements[1].x, 300);
    assert.equal(plan.totalWidth, 1200);
    assert.equal(plan.totalHeight, 1200);
});

test('gap and margin grow the canvas and offset placements', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = [
        { width: 100, height: 50 },
        { width: 100, height: 50 }
    ];

    const plan = createStitchPlan(images, {
        direction: 'vertical',
        showWave: false,
        gap: 10,
        margin: 20
    });

    assert.equal(plan.totalWidth, 140);
    assert.equal(plan.totalHeight, 150);
    assert.deepEqual(
        plan.placements.map(({ x, y, width, height }) => ({ x, y, width, height })),
        [
            { x: 20, y: 20, width: 100, height: 50 },
            { x: 20, y: 80, width: 100, height: 50 }
        ]
    );
});

test('horizontal gap and margin are applied to width and height', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = [
        { width: 60, height: 100 },
        { width: 40, height: 50 }
    ];

    const plan = createStitchPlan(images, {
        direction: 'horizontal',
        showWave: false,
        gap: 10,
        margin: 5
    });

    assert.equal(plan.totalWidth, 120);
    assert.equal(plan.totalHeight, 110);
    assert.deepEqual(
        plan.placements.map(({ x, y }) => ({ x, y })),
        [
            { x: 5, y: 5 },
            { x: 75, y: 30 }
        ]
    );
});

test('wave phase stays aligned when image sizes differ', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const vertical = createStitchPlan(
        [{ width: 1200, height: 800 }, { width: 600, height: 400 }],
        { direction: 'vertical', margin: 10 }
    );
    const horizontal = createStitchPlan(
        [{ width: 600, height: 1000 }, { width: 400, height: 500 }],
        { direction: 'horizontal', margin: 10 }
    );

    assert.equal(vertical.placements[0].bottomEdge.from, 10);
    assert.equal(vertical.placements[1].topEdge.from, 10);
    assert.equal(vertical.placements[0].bottomEdge.to, vertical.totalWidth - 10);
    assert.equal(horizontal.placements[0].rightEdge.from, 10);
    assert.equal(horizontal.placements[1].leftEdge.from, 10);
    assert.equal(horizontal.placements[0].rightEdge.to, horizontal.totalHeight - 10);
});

test('seam strength scales the wave amplitude', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = [
        { width: 300, height: 200 },
        { width: 300, height: 200 }
    ];

    const fine = createStitchPlan(images, { direction: 'vertical', seamStrength: 'fine' });
    const regular = createStitchPlan(images, { direction: 'vertical', seamStrength: 'regular' });
    const bold = createStitchPlan(images, { direction: 'vertical', seamStrength: 'bold' });

    assert.ok(fine.placements[0].bottomEdge.amplitude < regular.placements[0].bottomEdge.amplitude);
    assert.ok(bold.placements[0].bottomEdge.amplitude > regular.placements[0].bottomEdge.amplitude);
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

test('collage mode draws each shared seam shadow only once', async () => {
    const { createStitchPlan } = await loadLayoutModule();
    const images = Array.from({ length: 6 }, () => ({ width: 100, height: 100 }));

    const plan = createStitchPlan(images, { direction: 'collage', showWave: true });

    assert.equal(plan.seamShadows.length, 5);
});
