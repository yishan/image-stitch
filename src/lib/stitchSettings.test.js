import test from 'node:test';
import assert from 'node:assert/strict';
import { SLICE_HEIGHTS } from './exportSlices.js';
import { GRID_PRESET_IDS, SEAM_STRENGTH_IDS } from './stitchLayout.js';
import { EXPORT_FORMATS, SIZE_MODE_IDS } from './stitchRenderer.js';
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
        gridPreset: '3x3',
        backgroundColor: '#123abc',
        export: {
            format: 'gif',
            quality: 3,
            sizeMode: 'poster',
            customEdge: 1,
            sliceHeight: 1024
        }
    });

    assert.equal(settings.direction, 'vertical');
    assert.equal(settings.gap, 64);
    assert.equal(settings.margin, 0);
    assert.equal(settings.radius, 20);
    assert.equal(settings.seamStrength, 'regular');
    assert.equal(settings.previewMode, 'fit');
    assert.equal(settings.gridPreset, 'auto');
    assert.equal(settings.backgroundColor, '#123abc');
    assert.equal(settings.export.format, 'png');
    assert.equal(settings.export.quality, 1);
    assert.equal(settings.export.sizeMode, 'auto');
    assert.equal(settings.export.customEdge, 512);
    assert.equal(settings.export.sliceHeight, 0);
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

test('sanitizeSettings preserves every declared control choice', () => {
    for (const gridPreset of GRID_PRESET_IDS) {
        assert.equal(sanitizeSettings({ gridPreset }).gridPreset, gridPreset);
    }
    for (const seamStrength of SEAM_STRENGTH_IDS) {
        assert.equal(sanitizeSettings({ seamStrength }).seamStrength, seamStrength);
    }
    for (const { id: format } of Object.values(EXPORT_FORMATS)) {
        assert.equal(sanitizeSettings({ export: { format } }).export.format, format);
    }
    for (const sizeMode of SIZE_MODE_IDS) {
        assert.equal(sanitizeSettings({ export: { sizeMode } }).export.sizeMode, sizeMode);
    }
    for (const sliceHeight of SLICE_HEIGHTS) {
        assert.equal(sanitizeSettings({ export: { sliceHeight } }).export.sliceHeight, sliceHeight);
    }
});

test('sanitizeSettings accepts numeric slice heights stored as strings', () => {
    assert.equal(sanitizeSettings({ export: { sliceHeight: '4096' } }).export.sliceHeight, 4096);
});
