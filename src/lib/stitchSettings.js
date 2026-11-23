import { SLICE_HEIGHTS } from './exportSlices.js';
import { GRID_PRESET_IDS, SEAM_STRENGTH_IDS } from './stitchLayout.js';
import { DEFAULT_EXPORT_SETTINGS, EXPORT_FORMATS, SIZE_MODE_IDS } from './stitchRenderer.js';

export const DIRECTIONS = ['vertical', 'horizontal', 'collage'];
export const PREVIEW_MODES = ['fit', 'width'];
const EXPORT_FORMAT_IDS = Object.values(EXPORT_FORMATS).map(({ id }) => id);

export const isCustomHex = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '');

export const DEFAULT_SETTINGS = {
    direction: 'vertical',
    showWave: true,
    backgroundColor: 'transparent',
    gap: 0,
    margin: 0,
    radius: 0,
    seamStrength: 'regular',
    previewMode: 'fit',
    gridPreset: 'auto',
    export: { ...DEFAULT_EXPORT_SETTINGS }
};

const clampNumber = (value, min, max, fallback) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
};

const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** Defensive merge for values coming from localStorage / IndexedDB. */
export const sanitizeSettings = (candidate) => {
    const source = candidate && typeof candidate === 'object' ? candidate : {};
    const exportSource = source.export && typeof source.export === 'object' ? source.export : {};

    return {
        direction: pick(source.direction, DIRECTIONS, DEFAULT_SETTINGS.direction),
        showWave: source.showWave !== false,
        backgroundColor: typeof source.backgroundColor === 'string' && source.backgroundColor
            ? source.backgroundColor
            : DEFAULT_SETTINGS.backgroundColor,
        gap: clampNumber(source.gap, 0, 64, DEFAULT_SETTINGS.gap),
        margin: clampNumber(source.margin, 0, 64, DEFAULT_SETTINGS.margin),
        radius: clampNumber(source.radius, 0, 32, DEFAULT_SETTINGS.radius),
        seamStrength: pick(source.seamStrength, SEAM_STRENGTH_IDS, DEFAULT_SETTINGS.seamStrength),
        previewMode: pick(source.previewMode, PREVIEW_MODES, DEFAULT_SETTINGS.previewMode),
        gridPreset: pick(source.gridPreset, GRID_PRESET_IDS, DEFAULT_SETTINGS.gridPreset),
        export: {
            ...DEFAULT_EXPORT_SETTINGS,
            format: pick(exportSource.format, EXPORT_FORMAT_IDS, DEFAULT_EXPORT_SETTINGS.format),
            quality: clampNumber(exportSource.quality, 0.3, 1, DEFAULT_EXPORT_SETTINGS.quality),
            sizeMode: pick(exportSource.sizeMode, SIZE_MODE_IDS, DEFAULT_EXPORT_SETTINGS.sizeMode),
            customEdge: clampNumber(exportSource.customEdge, 512, 16384, DEFAULT_EXPORT_SETTINGS.customEdge),
            sliceHeight: pick(Number(exportSource.sliceHeight), SLICE_HEIGHTS, DEFAULT_EXPORT_SETTINGS.sliceHeight)
        }
    };
};
