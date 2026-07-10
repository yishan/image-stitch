import { createStitchPlan, getSeamStrokeMetrics, getWaveOffset } from './stitchLayout.js';

export const DEFAULT_OUTPUT_LIMITS = {
    maxEdge: 8192,
    maxPixels: 20_000_000
};

export const DEFAULT_SOURCE_LIMITS = {
    maxTotalPixels: 18_000_000,
    maxEdge: 8192,
    maxAspectRatio: 30
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
        throw new Error(`图片宽高比不能超过 ${normalizedLimits.maxAspectRatio}:1。`);
    }
};

export const canvasToBlob = (canvas, type = 'image/png') => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图片编码失败，请降低图片尺寸后重试。'));
    }, type);
});

export const loadImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取图片，请确认图片格式正确。'));
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

export const loadImagesForRender = async (imageRecords, limits = DEFAULT_SOURCE_LIMITS) => {
    const normalizedLimits = { ...DEFAULT_SOURCE_LIMITS, ...(limits || {}) };
    const maxTotalPixels = normalizedLimits.maxTotalPixels;
    const maxPixelsPerImage = Math.max(1, Math.floor(maxTotalPixels / imageRecords.length));
    const renderableImages = [];

    try {
        for (const record of imageRecords) {
            const image = await loadImage(record.url);
            validateImageDimensions(image.width, image.height, normalizedLimits);
            const dimensions = getBoundedImageDimensions(
                image.width,
                image.height,
                maxPixelsPerImage,
                normalizedLimits.maxEdge
            );
            renderableImages.push(await resizeImage(image, dimensions));
        }

        return renderableImages;
    } catch (error) {
        releaseRenderableImages(renderableImages);
        throw error;
    }
};

const traceWaveLine = (ctx, seam, offset = 0) => {
    const { orientation, x, y, from, to, amplitude, wavelength } = seam;
    const step = 4;

    ctx.beginPath();

    for (let pos = from; pos <= to; pos += step) {
        const waveOffset = getWaveOffset(pos, from, amplitude, wavelength);
        const pointX = orientation === 'vertical' ? x + waveOffset + offset : pos;
        const pointY = orientation === 'vertical' ? pos : y + waveOffset + offset;

        if (pos === from) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
    }

    const finalWaveOffset = getWaveOffset(to, from, amplitude, wavelength);
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

    for (let x = start; reverse ? x >= end : x <= end; x += direction) {
        const y = edge.y + getWaveOffset(x, edge.from, edge.amplitude, edge.wavelength);
        ctx.lineTo(x, y);
    }

    ctx.lineTo(end, edge.y + getWaveOffset(end, edge.from, edge.amplitude, edge.wavelength));
};

const addVerticalEdge = (ctx, edge, top, bottom, reverse = false) => {
    const step = 4;
    const start = reverse ? bottom : top;
    const end = reverse ? top : bottom;
    const direction = reverse ? -step : step;

    for (let y = start; reverse ? y >= end : y <= end; y += direction) {
        const x = edge.x + getWaveOffset(y, edge.from, edge.amplitude, edge.wavelength);
        ctx.lineTo(x, y);
    }

    ctx.lineTo(edge.x + getWaveOffset(end, edge.from, edge.amplitude, edge.wavelength), end);
};

const createImageClipPath = (ctx, placement) => {
    const { x, y, width, height, topEdge, rightEdge, bottomEdge, leftEdge } = placement;
    const rightX = x + width;
    const bottomY = y + height;

    ctx.beginPath();
    ctx.moveTo(x, topEdge ? topEdge.y + getWaveOffset(x, topEdge.from, topEdge.amplitude, topEdge.wavelength) : y);

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

const drawRippleStitchedImages = (ctx, placements) => {
    placements.forEach((placement) => {
        const leftOverlap = placement.leftEdge?.amplitude ?? 0;
        const rightOverlap = placement.rightEdge?.amplitude ?? 0;
        const topOverlap = placement.topEdge?.amplitude ?? 0;
        const bottomOverlap = placement.bottomEdge?.amplitude ?? 0;

        ctx.save();
        createImageClipPath(ctx, placement);
        ctx.clip();
        ctx.drawImage(
            placement.img,
            placement.x - leftOverlap,
            placement.y - topOverlap,
            placement.width + leftOverlap + rightOverlap,
            placement.height + topOverlap + bottomOverlap
        );
        ctx.restore();
    });
};

const drawDirectStitchedImages = (ctx, placements) => {
    placements.forEach((placement) => {
        ctx.drawImage(placement.img, placement.x, placement.y, placement.width, placement.height);
    });
};

export const renderStitch = (canvas, loadedImages, settings, limits) => {
    const plan = createStitchPlan(loadedImages, settings);
    const { totalWidth, totalHeight, placements, seamShadows } = plan;
    const { width, height, scale } = getOutputDimensions(totalWidth, totalHeight, limits);
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('当前浏览器不支持 Canvas 图片处理。');

    canvas.width = width;
    canvas.height = height;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    if (settings.showWave === false) drawDirectStitchedImages(ctx, placements);
    else {
        drawRippleStitchedImages(ctx, placements);
        drawRippleSeamShadows(ctx, seamShadows, totalWidth, totalHeight);
    }

    ctx.restore();

    return { ...plan, width, height, scale };
};
