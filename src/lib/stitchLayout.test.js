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
