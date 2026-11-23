const encoder = new TextEncoder();

export const SLICE_HEIGHTS = [0, 2048, 4096, 8192];

const normalizeSliceHeight = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
};

/** Split a tall canvas into top-to-bottom ranges. */
export const getSliceRanges = (height, sliceHeight) => {
    const totalHeight = Math.max(1, Math.floor(Number(height) || 0));
    const limit = normalizeSliceHeight(sliceHeight);
    if (limit === 0 || limit >= totalHeight) {
        return [{ index: 0, y: 0, height: totalHeight }];
    }

    const count = Math.ceil(totalHeight / limit);
    return Array.from({ length: count }, (_, index) => ({
        index,
        y: index * limit,
        height: Math.min(limit, totalHeight - index * limit)
    }));
};

export const getSliceCount = (height, sliceHeight) => getSliceRanges(height, sliceHeight).length;

export const padNumber = (value, size = 2) => String(value).padStart(size, '0');

/** Sortable filename for the Nth slice of M. */
export const sliceFilename = (base, index, total, extension) => (
    `${base}-part-${padNumber(index + 1)}-of-${padNumber(total)}.${extension}`
);

const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('切片编码失败。'));
    }, type, quality);
});

const drawSlice = (source, range, background) => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = range.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const error = new Error('Canvas is unsupported');
        error.code = 'canvasUnsupported';
        throw error;
    }
    if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(source, 0, range.y, source.width, range.height, 0, 0, source.width, range.height);
    return canvas;
};

/**
 * Crop every slice before the first await: the source is the live preview
 * canvas, which a re-render can redraw while earlier slices are encoding.
 */
const encodeSlices = async (source, sliceHeight, encode, background) => {
    const ranges = getSliceRanges(source.height, sliceHeight);
    const canvases = ranges.map((range) => drawSlice(source, range, background));
    const results = [];
    try {
        for (const [index, range] of ranges.entries()) {
            results.push(await encode(canvases[index], range));
        }
    } finally {
        canvases.forEach((canvas) => { canvas.width = 0; });
    }
    return results;
};

export const sliceCanvasToBlobs = (canvas, { sliceHeight, mime = 'image/png', quality } = {}) => (
    encodeSlices(canvas, sliceHeight, async (slice, range) => ({
        ...range,
        blob: await canvasToBlob(slice, mime, quality)
    }))
);

const concatBytes = (chunks) => {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const bytes = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
        bytes.set(chunk, offset);
        offset += chunk.length;
    });
    return bytes;
};

const asBytes = (value) => (value instanceof Uint8Array ? value : encoder.encode(String(value)));

/**
 * Minimal image-only PDF writer: one JPEG XObject per page, page size equal to
 * the source pixels. No dependency and no network access.
 */
export const buildImagePdf = (pages) => {
    if (!Array.isArray(pages) || pages.length === 0) {
        const error = new Error('No images for PDF');
        error.code = 'pdfEmpty';
        throw error;
    }

    const chunks = [encoder.encode('%PDF-1.4\n')];
    const lengths = [chunks[0].length];
    const push = (value) => {
        const bytes = asBytes(value);
        chunks.push(bytes);
        lengths.push(bytes.length);
        return lengths.reduce((sum, length) => sum + length, 0);
    };

    const objectTotal = 2 + pages.length * 3;
    const objectIds = Array.from({ length: objectTotal }, (_, index) => index + 1);
    const offsets = new Map();

    const totalLength = () => lengths.reduce((sum, length) => sum + length, 0);
    const beginObject = (id) => {
        offsets.set(id, totalLength());
        push(`${id} 0 obj\n`);
    };
    const endObject = () => push('endobj\n');

    // 1: catalog, 2: pages
    beginObject(1);
    push('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObject();
    beginObject(2);
    push(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] >>\n`);
    endObject();

    pages.forEach((page, index) => {
        const pageId = 3 + index * 3;
        const contentId = pageId + 1;
        const imageId = pageId + 2;
        const width = Math.max(1, Math.round(page.width));
        const height = Math.max(1, Math.round(page.height));
        const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
        const contentBytes = encoder.encode(content);

        beginObject(pageId);
        push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>\n`);
        endObject();

        beginObject(contentId);
        push(`<< /Length ${contentBytes.length} >>\nstream\n`);
        push(contentBytes);
        push('endstream\n');
        endObject();

        beginObject(imageId);
        push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
        push(page.jpeg);
        push('\nendstream\n');
        endObject();
    });

    const xrefOffset = lengths.reduce((sum, length) => sum + length, 0);
    const rows = objectIds.map((id) => {
        const offset = offsets.get(id) || 0;
        return `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    push('xref\n');
    push(`0 ${objectIds.length + 1}\n`);
    push('0000000000 65535 f \n');
    push(rows.join(''));
    push(`trailer\n<< /Size ${objectIds.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    return concatBytes(chunks);
};

export const canvasToPdfBlob = async (canvas, { sliceHeight, quality = 0.92 } = {}) => {
    const pages = await encodeSlices(canvas, sliceHeight, async (slice) => {
        const blob = await canvasToBlob(slice, 'image/jpeg', quality);
        return { width: slice.width, height: slice.height, jpeg: new Uint8Array(await blob.arrayBuffer()) };
    }, '#ffffff');
    return new Blob([buildImagePdf(pages)], { type: 'application/pdf' });
};
