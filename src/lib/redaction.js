const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export const REDACTION_MODES = ['mosaic', 'color'];
export const DEFAULT_REDACTION_COLOR = '#201c17';

export const isHexColor = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '');

export const getRedactionColor = (value) => (
    isHexColor(value) ? value : DEFAULT_REDACTION_COLOR
);

/** Normalize a drag rectangle to fractions of the output image. */
export const normalizeRedaction = (rect) => {
    const x = clamp01(rect?.x);
    const y = clamp01(rect?.y);
    const width = Math.min(1 - x, Math.max(0, Number(rect?.width) || 0));
    const height = Math.min(1 - y, Math.max(0, Number(rect?.height) || 0));
    return { x, y, width, height };
};

export const isUsableRedaction = (rect) => (
    rect && rect.width > 0.002 && rect.height > 0.002
);

/**
 * Replace each region with a coarse mosaic. The result is baked into the
 * canvas before encoding, so the exported file contains no original pixels.
 */
export const applyRedactions = (canvas, redactions, options = {}) => {
    const list = Array.isArray(redactions) ? redactions : [];
    if (list.length === 0) return canvas;

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;
    const minBlock = Math.max(4, Number(options.minBlock) || 8);

    list.forEach((raw) => {
        const rect = normalizeRedaction(raw);
        const x = Math.floor(rect.x * canvas.width);
        const y = Math.floor(rect.y * canvas.height);
        const width = Math.max(1, Math.floor(rect.width * canvas.width));
        const height = Math.max(1, Math.floor(rect.height * canvas.height));
        if (width < 1 || height < 1) return;

        const block = Math.max(minBlock, Math.round(Math.min(width, height) / 12));
        const columns = Math.max(1, Math.ceil(width / block));
        const rows = Math.max(1, Math.ceil(height / block));
        if (raw.mode === 'color') {
            ctx.save();
            ctx.fillStyle = getRedactionColor(raw.color);
            ctx.fillRect(x, y, width, height);
            ctx.restore();
            return;
        }

        const tile = document.createElement('canvas');
        tile.width = columns;
        tile.height = rows;
        const tileCtx = tile.getContext('2d');
        if (!tileCtx) return;
        tileCtx.imageSmoothingEnabled = false;
        tileCtx.drawImage(canvas, x, y, width, height, 0, 0, columns, rows);

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tile, 0, 0, columns, rows, x, y, width, height);
        ctx.restore();
    });

    return canvas;
};
