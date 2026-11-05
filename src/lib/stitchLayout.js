import { getRotatedDimensions, normalizeTransform } from './imageTransform.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const SEAM_STRENGTH_FACTORS = {
    fine: 0.6,
    regular: 1,
    bold: 1.6
};

export const SEAM_STRENGTHS = [
    ['fine', '细'],
    ['regular', '标准'],
    ['bold', '粗']
];

export const GRID_PRESETS = [
    ['auto', '自动网格'],
    ['2x2', '2×2 网格'],
    ['1+2', '1 + 2'],
    ['1+3', '1 + 3']
];

/**
 * Approximate aspect ratio of the fixed cell an image is placed in. Used by
 * the focus editor preview; gap/margin are intentionally ignored because they
 * only shift the crop by a pixel or two. Returns 1 for free-flow layouts.
 */
export const getGridCellAspect = (preset, index, count) => {
    if (!['2x2', '1+2', '1+3'].includes(preset)) return 1;
    if (!Number.isInteger(index) || !Number.isInteger(count) || index < 0 || index >= count) return 1;

    if (preset === '2x2') {
        const rowStart = Math.floor(index / 2) * 2;
        const rowCount = Math.min(2, count - rowStart);
        return rowCount === 1 ? 2 : 1;
    }

    if (index === 0) return 2 / 0.6;

    const columns = preset === '1+2' ? 2 : 3;
    const restIndex = index - 1;
    const restCount = count - 1;
    const rowStart = Math.floor(restIndex / columns) * columns;
    const rowCount = Math.min(columns, restCount - rowStart);
    const cellWidth = 2 / rowCount;
    return cellWidth / (cellWidth * 0.75);
};

export const getWaveOffset = (pos, from, amplitude, wavelength) => (
    Math.sin(((pos - from) / wavelength) * Math.PI * 2) * amplitude
);

export const getRippleMetrics = (totalWidth, totalHeight) => {
    const baseSize = Math.min(totalWidth, totalHeight);
    const amplitude = clamp(baseSize * 0.004, 2.5, 5.5);
    const wavelength = clamp(baseSize * 0.018, 16, 30);

    return { amplitude, wavelength };
};

export const getSeamStrokeMetrics = (totalWidth, totalHeight) => {
    const baseSize = Math.min(totalWidth, totalHeight);
    const lineWidth = clamp(baseSize * 0.001, 0.75, 1.4);
    const offset = clamp(baseSize * 0.00045, 0.7, 1.1);

    return { lineWidth, offset };
};

const createEdge = ({ orientation, x, y, from, to, phase = from, amplitude, wavelength }) => ({
    orientation,
    x,
    y,
    from,
    to,
    phase,
    amplitude,
    wavelength
});

const sumWidths = (items, gap) => (
    items.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, items.length - 1)
);

const maxOf = (items, key) => (
    items.length === 0 ? 0 : Math.max(...items.map((item) => item[key]))
);

const normalizeItems = (loadedImages) => loadedImages.map((entry) => {
    const image = entry.image || entry.img || entry;
    const transform = normalizeTransform(entry.transform);
    const rotated = getRotatedDimensions(image.width, image.height, transform.rotate);

    return {
        image,
        transform,
        width: rotated.width,
        height: rotated.height
    };
});

const fitDimensions = (item, cellWidth) => {
    if (item.transform.fit === 'cover') {
        return {
            width: cellWidth,
            height: item.height * (cellWidth / item.width)
        };
    }

    return { width: item.width, height: item.height };
};

const fitDimensionsHorizontal = (item, cellHeight) => {
    if (item.transform.fit === 'cover') {
        return {
            width: item.width * (cellHeight / item.height),
            height: cellHeight
        };
    }

    return { width: item.width, height: item.height };
};

const placementOf = (item, rect, { zoomable = false } = {}) => ({
    img: item.image,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    transform: item.transform,
    fit: item.transform.fit,
    zoom: zoomable ? item.transform.zoom : 1
});

const gridPlacementOf = (item, rect) => placementOf(item, rect, { zoomable: true });

/**
 * Fixed-cell grid presets. Unlike the three free-flow layouts these use a
 * deterministic grid, so `contain` letterboxes inside a cell and `cover`
 * crops around the per-image focus point.
 */
const createGridPlan = (items, { preset, gap, margin }) => {
    const placements = [];
    const baseCell = Math.max(1, maxOf(items, 'width'));
    const contentWidth = baseCell * 2 + gap;
    const totalWidth = contentWidth + margin * 2;
    let contentHeight = 0;

    if (preset === '2x2') {
        const columns = 2;
        const rowHeight = baseCell;
        const rows = Math.ceil(items.length / columns);

        items.forEach((item, index) => {
            const rowIndex = Math.floor(index / columns);
            const rowItems = items.slice(rowIndex * columns, rowIndex * columns + columns);
            const cellWidth = rowItems.length === 1
                ? contentWidth
                : (contentWidth - gap) / columns;
            const x = margin + (index % columns) * (cellWidth + gap);
            const y = margin + rowIndex * (rowHeight + gap);
            placements.push(gridPlacementOf(item, { x, y, width: cellWidth, height: rowHeight }));
        });
        contentHeight = rows * rowHeight + gap * Math.max(0, rows - 1);
    } else {
        const columns = preset === '1+2' ? 2 : 3;
        const heroHeight = Math.max(1, Math.round(contentWidth * 0.6));
        const rest = items.slice(1);
        const rowGroups = [];
        for (let index = 0; index < rest.length; index += columns) {
            rowGroups.push(rest.slice(index, index + columns));
        }
        const rowHeights = rowGroups.map((row) => {
            const cellWidth = (contentWidth - gap * (row.length - 1)) / row.length;
            return Math.max(1, Math.round(cellWidth * 0.75));
        });

        let rowY = margin + heroHeight + gap;
        rowGroups.forEach((row, rowIndex) => {
            const cellWidth = (contentWidth - gap * (row.length - 1)) / row.length;
            row.forEach((item, index) => {
                const x = margin + index * (cellWidth + gap);
                placements.push(gridPlacementOf(item, {
                    x,
                    y: rowY,
                    width: cellWidth,
                    height: rowHeights[rowIndex]
                }));
            });
            rowY += rowHeights[rowIndex] + gap;
        });

        const heroItem = items[0];
        if (heroItem) {
            placements.unshift(gridPlacementOf(heroItem, {
                x: margin,
                y: margin,
                width: contentWidth,
                height: heroHeight
            }));
        }
        const restHeight = rowGroups.length > 0
            ? rowHeights.reduce((sum, height) => sum + height, 0) + gap * (rowGroups.length - 1)
            : 0;
        contentHeight = heroHeight + (rest.length > 0 ? gap + restHeight : 0);
    }

    return {
        totalWidth,
        totalHeight: contentHeight + margin * 2,
        placements,
        seamShadows: [],
        gap,
        margin,
        direct: true,
        preset
    };
};

/**
 * Geometry for the layouts. Free-flow layouts (vertical/horizontal/collage)
 * keep natural image sizes and only upscale when a per-image `cover` fit asks
 * for it; grid presets use fixed cells and support crop + focus.
 */
export const createStitchPlan = (loadedImages, settings = {}) => {
    if (!loadedImages || loadedImages.length === 0) {
        return {
            totalWidth: 0,
            totalHeight: 0,
            placements: [],
            seamShadows: [],
            gap: 0,
            margin: 0
        };
    }

    const direction = settings.direction || 'vertical';
    const showWave = settings.showWave !== false;
    const gap = clamp(Number(settings.gap) || 0, 0, 256);
    const margin = clamp(Number(settings.margin) || 0, 0, 256);
    const strength = SEAM_STRENGTH_FACTORS[settings.seamStrength] || 1;
    const gridPreset = settings.gridPreset || 'auto';
    const placements = [];
    const seamShadows = [];
    const images = normalizeItems(loadedImages);

    if (direction === 'collage' && gridPreset !== 'auto') {
        return createGridPlan(images, { preset: gridPreset, gap, margin });
    }

    if (direction === 'horizontal') {
        const maxHeight = maxOf(images, 'height');
        const fitted = images.map((item) => fitDimensionsHorizontal(item, maxHeight));
        const totalWidth = fitted.reduce((sum, item) => sum + item.width, 0) + gap * (images.length - 1) + margin * 2;
        const totalHeight = maxHeight + margin * 2;
        const baseMetrics = getRippleMetrics(totalWidth, totalHeight);
        const amplitude = baseMetrics.amplitude * strength;
        const { wavelength } = baseMetrics;

        let cursorX = margin;
        images.forEach((item, index) => {
            const draw = fitted[index];
            const y = margin + (maxHeight - draw.height) / 2;
            const next = fitted[index + 1];
            const nextY = next ? margin + (maxHeight - next.height) / 2 : 0;

            const leftEdge = showWave && index > 0
                ? createEdge({
                    orientation: 'vertical',
                    x: cursorX,
                    from: y,
                    to: y + draw.height,
                    phase: margin,
                    amplitude,
                    wavelength
                })
                : null;
            const rightEdge = showWave && index < images.length - 1
                ? createEdge({
                    orientation: 'vertical',
                    x: cursorX + draw.width,
                    from: Math.max(y, nextY),
                    to: Math.min(y + draw.height, nextY + next.height),
                    phase: margin,
                    amplitude,
                    wavelength
                })
                : null;

            if (rightEdge && rightEdge.to > rightEdge.from) seamShadows.push(rightEdge);

            placements.push({
                ...placementOf(item, {
                    x: cursorX,
                    y,
                    width: draw.width,
                    height: draw.height
                }),
                leftEdge,
                rightEdge
            });

            cursorX += draw.width + gap;
        });

        return { totalWidth, totalHeight, placements, seamShadows, gap, margin };
    }

    if (direction === 'collage') {
        const splitIndex = images.length === 4 ? 2 : 3;
        const row1 = images.slice(0, splitIndex);
        const row2 = images.slice(splitIndex, splitIndex * 2);
        const rows = [row1, row2].filter((row) => row.length > 0);
        const row1Height = maxOf(row1, 'height');
        const row2Height = maxOf(row2, 'height');
        const contentWidth = Math.max(sumWidths(row1, gap), sumWidths(row2, gap));
        const contentHeight = rows.length > 1 ? row1Height + gap + row2Height : row1Height;
        const totalWidth = contentWidth + margin * 2;
        const totalHeight = contentHeight + margin * 2;
        const baseMetrics = getRippleMetrics(totalWidth, totalHeight);
        const amplitude = baseMetrics.amplitude * strength;
        const { wavelength } = baseMetrics;
        const row1Width = sumWidths(row1, gap);
        const row2Width = sumWidths(row2, gap);
        const row1X = margin + (contentWidth - row1Width) / 2;
        const row2X = margin + (contentWidth - row2Width) / 2;
        const row1Y = margin;
        const row2Y = margin + row1Height + gap;
        const seamY = row1Y + row1Height;

        const placeRow = (row, rowIndex) => {
            const rowHeight = maxOf(row, 'height');
            const rowX = rowIndex === 0 ? row1X : row2X;
            const rowY = rowIndex === 0 ? row1Y : row2Y;
            let cursorX = rowX;

            row.forEach((item, itemIndex) => {
                const x = cursorX;
                const y = rowY + (rowHeight - item.height) / 2;
                const isFirstRow = rowIndex === 0;
                const leftEdge = showWave && itemIndex > 0
                    ? createEdge({
                        orientation: 'vertical',
                        x,
                        from: rowY,
                        to: rowY + rowHeight,
                        phase: rowY,
                        amplitude,
                        wavelength
                    })
                    : null;
                const rightEdge = showWave && itemIndex < row.length - 1
                    ? createEdge({
                        orientation: 'vertical',
                        x: x + item.width,
                        from: rowY,
                        to: rowY + rowHeight,
                        phase: rowY,
                        amplitude,
                        wavelength
                    })
                    : null;
                const topEdge = showWave && !isFirstRow && row.length > 0
                    ? createEdge({
                        orientation: 'horizontal',
                        y: seamY,
                        from: x,
                        to: x + item.width,
                        phase: margin,
                        amplitude,
                        wavelength
                    })
                    : null;
                const bottomEdge = showWave && isFirstRow && row2.length > 0
                    ? createEdge({
                        orientation: 'horizontal',
                        y: seamY,
                        from: x,
                        to: x + item.width,
                        phase: margin,
                        amplitude,
                        wavelength
                    })
                    : null;

                if (leftEdge) seamShadows.push(leftEdge);

                placements.push({
                    ...placementOf(item, {
                        x,
                        y,
                        width: item.width,
                        height: item.height
                    }),
                    topEdge,
                    rightEdge,
                    bottomEdge,
                    leftEdge
                });

                cursorX += item.width + gap;
            });
        };

        placeRow(row1, 0);
        if (row2.length > 0) placeRow(row2, 1);

        if (showWave && row2.length > 0) {
            // One continuous seam shadow, clipped to where both rows overlap.
            const seamStart = Math.max(row1X, row2X);
            const seamEnd = Math.min(row1X + row1Width, row2X + row2Width);
            if (seamEnd > seamStart) {
                seamShadows.push(createEdge({
                    orientation: 'horizontal',
                    y: seamY,
                    from: seamStart,
                    to: seamEnd,
                    phase: margin,
                    amplitude,
                    wavelength
                }));
            }
        }

        return { totalWidth, totalHeight, placements, seamShadows, gap, margin };
    }

    // Vertical (default)
    const maxWidth = maxOf(images, 'width');
    const fitted = images.map((item) => fitDimensions(item, maxWidth));
    const totalWidth = maxWidth + margin * 2;
    const totalHeight = fitted.reduce((sum, item) => sum + item.height, 0) + gap * (images.length - 1) + margin * 2;
    const baseMetrics = getRippleMetrics(totalWidth, totalHeight);
    const amplitude = baseMetrics.amplitude * strength;
    const { wavelength } = baseMetrics;

    let cursorY = margin;
    images.forEach((item, index) => {
        const draw = fitted[index];
        const x = margin + (maxWidth - draw.width) / 2;
        const y = cursorY;
        // Shared phase origin across the whole seam so mixed-width images
        // still meet on one continuous wave.
        const next = fitted[index + 1];
        const nextX = next ? margin + (maxWidth - next.width) / 2 : 0;
        const topEdge = showWave && index > 0
            ? createEdge({
                orientation: 'horizontal',
                y,
                from: x,
                to: x + draw.width,
                phase: margin,
                amplitude,
                wavelength
            })
            : null;
        const bottomEdge = showWave && index < images.length - 1
            ? createEdge({
                orientation: 'horizontal',
                y: y + draw.height,
                from: Math.max(x, nextX),
                to: Math.min(x + draw.width, nextX + next.width),
                phase: margin,
                amplitude,
                wavelength
            })
            : null;

        if (bottomEdge && bottomEdge.to > bottomEdge.from) seamShadows.push(bottomEdge);

        placements.push({
            ...placementOf(item, {
                x,
                y,
                width: draw.width,
                height: draw.height
            }),
            topEdge,
            bottomEdge
        });

        cursorY += draw.height + gap;
    });

    return { totalWidth, totalHeight, placements, seamShadows, gap, margin };
};
