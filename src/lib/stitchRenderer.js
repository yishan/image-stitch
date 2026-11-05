import { createStitchPlan, getSeamStrokeMetrics, getWaveOffset } from './stitchLayout.js';
import { createRenderCache } from './renderCache.js';
import { drawTransformedImage } from './imageDraw.js';

export const DEFAULT_OUTPUT_LIMITS = {
    maxEdge: 8192,
    maxPixels: 20_000_000
};

export const LONG_IMAGE_LIMITS = {
    maxEdge: 16384,
    maxPixels: 20_000_000
};

export const DEFAULT_SOURCE_LIMITS = {
    // Enough for six iPhone screenshots at their native size (6 × 1179×2556
    // ≈ 18.08 MP), so long-image mode can actually keep 1:1 width.
    maxTotalPixels: 19_000_000,
    maxEdge: 8192,
    maxAspectRatio: 30
};

export const EXPORT_FORMATS = {
    png: { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', lossy: false },
    jpeg: { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', lossy: true },
    webp: { id: 'webp', label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: true }
};

export const SIZE_MODE_OPTIONS = [
    ['auto', '默认（安全上限）'],
    ['long', '长图模式（保持宽度）'],
    ['edge4096', '长边 4096 px'],
    ['width1080', '宽 1080 px'],
    ['custom', '自定义长边']
];

export const BACKGROUND_FILLS = {
    transparent: 'rgba(0, 0, 0, 0)',
    paper: '#f6f3ed',
    white: '#ffffff',
    ink: '#201c17'
};

export const BACKGROUND_OPTIONS = [
    ['transparent', '透明'],
    ['paper', '纸色'],
    ['white', '白色'],
    ['ink', '墨色']
];

export const DEFAULT_EXPORT_SETTINGS = {
    format: 'png',
    quality: 0.9,
    sizeMode: 'auto',
    customEdge: 4096,
    sliceHeight: 0
};

export const getExportFormat = (id) => EXPORT_FORMATS[id] || EXPORT_FORMATS.png;

export const isTransparentColor = (color) => (
    !color || color === 'transparent' || /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(color)
);

export const resolveBackground = (value) => {
    if (!value || value === 'transparent') return BACKGROUND_FILLS.transparent;
    if (BACKGROUND_FILLS[value]) return BACKGROUND_FILLS[value];
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : BACKGROUND_FILLS.transparent;
};

let supportCache = null;

/** Feature-detect canvas encoders once; WebP is the only one that varies. */
export const getExportSupport = () => {
    if (supportCache) return supportCache;

    if (typeof document === 'undefined') {
        supportCache = { png: true, jpeg: true, webp: true };
        return supportCache;
    }

    const supports = (mime) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            return canvas.toDataURL(mime).startsWith(`data:${mime};`);
        } catch {
            return false;
        }
    };

    supportCache = { png: true, jpeg: supports('image/jpeg'), webp: supports('image/webp') };
    return supportCache;
};

export const getOutputScale = (totalWidth, totalHeight, limits = DEFAULT_OUTPUT_LIMITS) => {
    if (totalWidth <= 0 || totalHeight <= 0) return 1;

    const { maxEdge, maxPixels } = { ...DEFAULT_OUTPUT_LIMITS, ...limits };
    const edgeScale = maxEdge / Math.max(totalWidth, totalHeight);
    const pixelScale = Math.sqrt(maxPixels / (totalWidth * totalHeight));

    const scale = Math.min(1, edgeScale, pixelScale);

    return scale < 1 ? scale * (1 - Number.EPSILON) : scale;
};

export const getOutputDimensions = (totalWidth, totalHeight, limits) => {
    const scale = getOutputScale(totalWidth, totalHeight, limits);

    return {
        scale,
        width: Math.max(1, Math.floor(totalWidth * scale)),
        height: Math.max(1, Math.floor(totalHeight * scale))
    };
};

/**
 * Output dimensions for the export settings panel: size presets and the
 * long-image mode (relaxed edge cap, 1:1 width when the pixel budget allows).
 */
export const getExportDimensions = (totalWidth, totalHeight, exportSettings = {}, options = {}) => {
    const width = Math.max(0, Number(totalWidth) || 0);
    const height = Math.max(0, Number(totalHeight) || 0);
    const settings = { ...DEFAULT_EXPORT_SETTINGS, ...(exportSettings || {}) };
    const maxPixels = Math.max(1, Number(options.maxPixels) || DEFAULT_OUTPUT_LIMITS.maxPixels);

    if (width <= 0 || height <= 0) {
        return { scale: 1, width: 1, height: 1, mode: settings.sizeMode, maxEdge: DEFAULT_OUTPUT_LIMITS.maxEdge, maxPixels, scaled: false, binding: 'none' };
    }

    let maxEdge = DEFAULT_OUTPUT_LIMITS.maxEdge;
    let targetWidth = 0;

    switch (settings.sizeMode) {
        case 'long':
            maxEdge = LONG_IMAGE_LIMITS.maxEdge;
            break;
        case 'edge4096':
            maxEdge = 4096;
            break;
        case 'width1080':
            targetWidth = 1080;
            break;
        case 'custom':
            maxEdge = Math.min(16384, Math.max(512, Number(settings.customEdge) || 4096));
            break;
        default:
            maxEdge = DEFAULT_OUTPUT_LIMITS.maxEdge;
    }

    const candidates = [
        { name: 'edge', scale: maxEdge / Math.max(width, height) },
        { name: 'pixels', scale: Math.sqrt(maxPixels / (width * height)) }
    ];
    if (targetWidth > 0) candidates.push({ name: 'width', scale: targetWidth / width });

    const smallest = candidates.reduce((best, candidate) => (
        candidate.scale < best.scale ? candidate : best
    ));
    const scale = Math.min(1, smallest.scale);
    const binding = scale < 1 ? smallest.name : 'none';

    return {
        scale,
        width: Math.max(1, Math.floor(width * scale + 1e-9)),
        height: Math.max(1, Math.floor(height * scale + 1e-9)),
        mode: settings.sizeMode,
        maxEdge,
        maxPixels,
        scaled: scale < 1,
        binding
    };
};

/**
 * WebKit browsers refuse canvas areas above ~16.7 MP (the canvas goes blank
 * without throwing). Probe the target area once and fall back to a safe budget
 * instead of shipping an 18 MP long image that silently fails on iPhone.
 */
export const SAFE_CANVAS_AREA = 16_000_000;

const canvasAreaSupport = new Map();

export const canRenderCanvasArea = (area) => {
    if (typeof document === 'undefined' || area <= SAFE_CANVAS_AREA) return true;

    const bucket = Math.ceil(area / 1_000_000) * 1_000_000;
    if (canvasAreaSupport.has(bucket)) return canvasAreaSupport.get(bucket);

    let supported = false;
    try {
        const width = Math.min(8192, Math.ceil(Math.sqrt(bucket / 2)));
        const height = Math.ceil(bucket / width);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (context) {
            context.fillStyle = '#ff0000';
            context.fillRect(0, 0, width, height);
            const [red, , , alpha] = context.getImageData(0, 0, 1, 1).data;
            supported = red > 200 && alpha > 200;
        }
        canvas.width = 0;
        canvas.height = 0;
    } catch {
        supported = false;
    }

    canvasAreaSupport.set(bucket, supported);
    return supported;
};

export const getSafeMaxPixels = (targetPixels) => {
    if (targetPixels <= SAFE_CANVAS_AREA) return DEFAULT_OUTPUT_LIMITS.maxPixels;
    return canRenderCanvasArea(targetPixels) ? DEFAULT_OUTPUT_LIMITS.maxPixels : SAFE_CANVAS_AREA;
};

export const getBoundedImageDimensions = (width, height, maxPixels, maxEdge = Infinity) => {
    if (width <= 0 || height <= 0 || maxPixels <= 0) return { width: 1, height: 1 };

    const scale = Math.min(
        1,
        Math.sqrt(maxPixels / (width * height)),
        maxEdge / Math.max(width, height)
    );

    return {
        width: Math.max(1, Math.floor(width * scale)),
        height: Math.max(1, Math.floor(height * scale))
    };
};

export const validateImageDimensions = (width, height, limits = DEFAULT_SOURCE_LIMITS) => {
    const normalizedLimits = { ...DEFAULT_SOURCE_LIMITS, ...(limits || {}) };
    const shortestEdge = Math.min(width, height);
    const aspectRatio = shortestEdge > 0 ? Math.max(width, height) / shortestEdge : Infinity;

    if (aspectRatio > normalizedLimits.maxAspectRatio) {
        const error = new Error(`Aspect ratio exceeds ${normalizedLimits.maxAspectRatio}:1`);
        error.code = 'aspectRatio';
        error.params = { max: normalizedLimits.maxAspectRatio };
        throw error;
    }
};

export const canvasToBlob = (canvas, type = 'image/png', quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else {
            const error = new Error('Image encoding failed');
            error.code = 'encode';
            reject(error);
        }
    }, type, quality);
});

export const loadImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
        const error = new Error('Image decode failed');
        error.code = 'decodeFailed';
        reject(error);
    };
    image.src = url;
});

const resizeImage = async (image, dimensions) => {
    if (image.width === dimensions.width && image.height === dimensions.height) return image;

    if (typeof globalThis.createImageBitmap === 'function') {
        try {
            const bitmap = await globalThis.createImageBitmap(image, {
                resizeWidth: dimensions.width,
                resizeHeight: dimensions.height,
                resizeQuality: 'high'
            });
            image.src = '';
            return bitmap;
        } catch {
            // Fall through to the Canvas implementation for browsers with partial ImageBitmap support.
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) return image;

    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    image.src = '';
    return canvas;
};

export const releaseRenderableImages = (images) => {
    images.forEach((image) => {
        if (typeof image?.close === 'function') image.close();
        else if ('src' in image) image.src = '';
        else if ('width' in image && 'height' in image) {
            image.width = 1;
            image.height = 1;
        }
    });
};

const shrinkRenderableImage = async (image, target) => {
    if (typeof globalThis.createImageBitmap === 'function') {
        try {
            return await globalThis.createImageBitmap(image, {
                resizeWidth: target.width,
                resizeHeight: target.height,
                resizeQuality: 'high'
            });
        } catch {
            // Fall through to the Canvas implementation.
        }
    }

    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context) return image;
    context.drawImage(image, 0, 0, target.width, target.height);
    return canvas;
};

const renderCache = createRenderCache({
    release: (image) => releaseRenderableImages([image]),
    bounds: (sourceWidth, sourceHeight, budget) => getBoundedImageDimensions(
        sourceWidth,
        sourceHeight,
        budget,
        DEFAULT_SOURCE_LIMITS.maxEdge
    ),
    resize: shrinkRenderableImage
});

const cacheKeyFor = (record) => `${record?.id || ''}|${record?.url || ''}`;

const decodeRenderableImage = async (record, limits, maxPixelsPerImage) => {
    const image = await loadImage(record.url);
    const sourceWidth = image.width;
    const sourceHeight = image.height;
    validateImageDimensions(sourceWidth, sourceHeight, limits);
    const dimensions = getBoundedImageDimensions(
        sourceWidth,
        sourceHeight,
        maxPixelsPerImage,
        limits.maxEdge
    );
    const renderable = await resizeImage(image, dimensions);
    return { image: renderable, sourceWidth, sourceHeight };
};

export const loadImagesForRender = async (imageRecords, limits = DEFAULT_SOURCE_LIMITS) => {
    const normalizedLimits = { ...DEFAULT_SOURCE_LIMITS, ...(limits || {}) };
    const maxPixelsPerImage = Math.max(1, Math.floor(normalizedLimits.maxTotalPixels / imageRecords.length));

    const images = await Promise.all(imageRecords.map((record) => renderCache.get(
        cacheKeyFor(record),
        maxPixelsPerImage,
        (budget) => decodeRenderableImage(record, normalizedLimits, budget)
    )));

    return imageRecords.map((record, index) => ({
        image: images[index],
        width: images[index].width,
        height: images[index].height,
        transform: record.transform
    }));
};

export const pruneRenderCache = (imageRecords) => {
    const activeKeys = new Set(imageRecords.map((record) => cacheKeyFor(record)));
    return renderCache.prune(activeKeys);
};

export const clearRenderCache = () => renderCache.clear();

export const getRenderCacheStats = () => renderCache.stats;

const edgePhase = (edge) => edge.phase ?? edge.from;

const traceWaveLine = (ctx, seam, offset = 0) => {
    const { orientation, x, y, from, to, amplitude, wavelength } = seam;
    const phase = edgePhase(seam);
    const step = 4;

    ctx.beginPath();

    for (let pos = from; pos <= to; pos += step) {
        const waveOffset = getWaveOffset(pos, phase, amplitude, wavelength);
        const pointX = orientation === 'vertical' ? x + waveOffset + offset : pos;
        const pointY = orientation === 'vertical' ? pos : y + waveOffset + offset;

        if (pos === from) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
    }

    const finalWaveOffset = getWaveOffset(to, phase, amplitude, wavelength);
    ctx.lineTo(
        orientation === 'vertical' ? x + finalWaveOffset + offset : to,
        orientation === 'vertical' ? to : y + finalWaveOffset + offset
    );
};

const drawRippleSeamShadows = (ctx, seams, totalWidth, totalHeight) => {
    if (seams.length === 0) return;

    const { lineWidth, offset } = getSeamStrokeMetrics(totalWidth, totalHeight);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth;

    seams.forEach((seam) => {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
        traceWaveLine(ctx, seam, -offset);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(40, 40, 40, 0.42)';
        traceWaveLine(ctx, seam, offset);
        ctx.stroke();
    });

    ctx.restore();
};

const addHorizontalEdge = (ctx, edge, left, right, reverse = false) => {
    const step = 4;
    const start = reverse ? right : left;
    const end = reverse ? left : right;
    const direction = reverse ? -step : step;

    const phase = edgePhase(edge);

    for (let x = start; reverse ? x >= end : x <= end; x += direction) {
        const y = edge.y + getWaveOffset(x, phase, edge.amplitude, edge.wavelength);
        ctx.lineTo(x, y);
    }

    ctx.lineTo(end, edge.y + getWaveOffset(end, phase, edge.amplitude, edge.wavelength));
};

const addVerticalEdge = (ctx, edge, top, bottom, reverse = false) => {
    const step = 4;
    const start = reverse ? bottom : top;
    const end = reverse ? top : bottom;
    const direction = reverse ? -step : step;

    const phase = edgePhase(edge);

    for (let y = start; reverse ? y >= end : y <= end; y += direction) {
        const x = edge.x + getWaveOffset(y, phase, edge.amplitude, edge.wavelength);
        ctx.lineTo(x, y);
    }

    ctx.lineTo(edge.x + getWaveOffset(end, phase, edge.amplitude, edge.wavelength), end);
};

const createImageClipPath = (ctx, placement) => {
    const { x, y, width, height, topEdge, rightEdge, bottomEdge, leftEdge } = placement;
    const rightX = x + width;
    const bottomY = y + height;

    ctx.beginPath();
    ctx.moveTo(x, topEdge ? topEdge.y + getWaveOffset(x, edgePhase(topEdge), topEdge.amplitude, topEdge.wavelength) : y);

    if (topEdge) addHorizontalEdge(ctx, topEdge, x, rightX);
    else ctx.lineTo(rightX, y);

    if (rightEdge) addVerticalEdge(ctx, rightEdge, y, bottomY);
    else ctx.lineTo(rightX, bottomY);

    if (bottomEdge) addHorizontalEdge(ctx, bottomEdge, x, rightX, true);
    else ctx.lineTo(x, bottomY);

    if (leftEdge) addVerticalEdge(ctx, leftEdge, y, bottomY, true);
    else ctx.lineTo(x, y);

    ctx.closePath();
};

const drawPlacementImage = (ctx, placement, grow = 0) => {
    drawTransformedImage(
        ctx,
        placement.img,
        placement.transform,
        {
            x: placement.x - grow,
            y: placement.y - grow,
            width: placement.width + grow * 2,
            height: placement.height + grow * 2
        },
        {
            fit: grow > 0 ? 'cover' : (placement.fit || placement.transform?.fit),
            focusX: grow > 0 ? 0.5 : undefined,
            focusY: grow > 0 ? 0.5 : undefined,
            zoom: grow > 0 ? 1 : placement.zoom
        }
    );
};

const drawRippleStitchedImages = (ctx, placements) => {
    placements.forEach((placement) => {
        const overlap = Math.max(
            placement.leftEdge?.amplitude ?? 0,
            placement.rightEdge?.amplitude ?? 0,
            placement.topEdge?.amplitude ?? 0,
            placement.bottomEdge?.amplitude ?? 0
        );

        ctx.save();
        createImageClipPath(ctx, placement);
        ctx.clip();
        drawPlacementImage(ctx, placement, overlap);
        ctx.restore();
    });
};

const traceRoundedRect = (ctx, x, y, width, height, radius) => {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
};

const drawDirectStitchedImages = (ctx, placements, radius = 0) => {
    placements.forEach((placement) => {
        if (radius > 0) {
            ctx.save();
            traceRoundedRect(ctx, placement.x, placement.y, placement.width, placement.height, radius);
            ctx.clip();
            drawPlacementImage(ctx, placement);
            ctx.restore();
            return;
        }
        drawPlacementImage(ctx, placement);
    });
};

const clampRadius = (value) => Math.min(64, Math.max(0, Number(value) || 0));

export const renderStitch = (canvas, loadedImages, settings = {}, options = {}) => {
    const plan = createStitchPlan(loadedImages, settings);
    const exportSettings = { ...DEFAULT_EXPORT_SETTINGS, ...(settings.export || {}) };
    const format = getExportFormat(exportSettings.format);
    const dimensions = getExportDimensions(plan.totalWidth, plan.totalHeight, exportSettings, {
        maxPixels: options.maxPixels
    });
    const { width, height, scale } = dimensions;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        const error = new Error('Canvas is unsupported');
        error.code = 'canvasUnsupported';
        throw error;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.save();
    ctx.scale(scale, scale);

    const background = resolveBackground(settings.backgroundColor);
    const flatten = format.mime === 'image/jpeg' && isTransparentColor(background);
    const fill = flatten ? BACKGROUND_FILLS.white : background;

    if (isTransparentColor(fill)) ctx.clearRect(0, 0, plan.totalWidth, plan.totalHeight);
    else {
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, plan.totalWidth, plan.totalHeight);
    }

    if (plan.direct || settings.showWave === false) {
        const radius = clampRadius(settings.radius);
        drawDirectStitchedImages(ctx, plan.placements, radius);
    } else {
        drawRippleStitchedImages(ctx, plan.placements);
        drawRippleSeamShadows(ctx, plan.seamShadows, plan.totalWidth, plan.totalHeight);
    }

    ctx.restore();

    return {
        ...plan,
        ...dimensions,
        format,
        exportSettings,
        background,
        fill,
        flattened: flatten
    };
};
