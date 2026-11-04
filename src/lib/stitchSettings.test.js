import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, sanitizeSettings } from './stitchSettings.js';

test('sanitizeSettings falls back to defaults for missing values', () => {
    assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
    assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
    assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS);
});

test('sanitizeSettings clamps numeric fields and rejects unknown enums', () => {
    const settings = sanitizeSettings({
        direction: 'diagonal',
        gap: 999,
        margin: -4,
        radius: '20',
        seamStrength: 'huge',
        previewMode: 'zoom',
        backgroundColor: '#123abc',
        export: {
            format: 'gif',
            quality: 3,
            sizeMode: 'poster',
            customEdge: 1
        }
    });

    assert.equal(settings.direction, 'vertical');
    assert.equal(settings.gap, 64);
    assert.equal(settings.margin, 0);
    assert.equal(settings.radius, 20);
    assert.equal(settings.seamStrength, 'regular');
    assert.equal(settings.previewMode, 'fit');
    assert.equal(settings.backgroundColor, '#123abc');
    assert.equal(settings.export.format, 'png');
    assert.equal(settings.export.quality, 1);
    assert.equal(settings.export.sizeMode, 'auto');
    assert.equal(settings.export.customEdge, 512);
});

test('sanitizeSettings preserves valid custom values', () => {
    const settings = sanitizeSettings({
        direction: 'collage',
        showWave: false,
        gap: 16,
        margin: 24,
        radius: 8,
        seamStrength: 'bold',
        previewMode: 'width',
        backgroundColor: 'paper',
        export: { format: 'jpeg', quality: 0.85, sizeMode: 'long', customEdge: 8192 }
    });

    assert.equal(settings.direction, 'collage');
    assert.equal(settings.showWave, false);
    assert.equal(settings.gap, 16);
    assert.equal(settings.margin, 24);
    assert.equal(settings.radius, 8);
    assert.equal(settings.seamStrength, 'bold');
    assert.equal(settings.previewMode, 'width');
    assert.equal(settings.backgroundColor, 'paper');
    assert.equal(settings.export.format, 'jpeg');
    assert.equal(settings.export.quality, 0.85);
    assert.equal(settings.export.sizeMode, 'long');
    assert.equal(settings.export.customEdge, 8192);
});
