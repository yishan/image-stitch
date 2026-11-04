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

const createEdge = ({ orientation, x, y, from, to, amplitude, wavelength }) => ({
    orientation,
    x,
    y,
    from,
    to,
    amplitude,
    wavelength
});

const sumWidths = (items, gap) => (
    items.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(0, items.length - 1)
);

const maxOf = (items, key) => (
    items.length === 0 ? 0 : Math.max(...items.map((item) => item[key]))
);

/**
 * Geometry for the three layouts. Images keep their original size (never
 * upscaled); the stitched canvas grows around them with optional gap/margin.
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
    const placements = [];
    const seamShadows = [];
    const images = loadedImages.map((img) => ({
        img,
        width: img.width,
        height: img.height
    }));

    if (direction === 'horizontal') {
        const maxHeight = maxOf(images, 'height');
        const totalWidth = sumWidths(images, gap) + margin * 2;
        const totalHeight = maxHeight + margin * 2;
        const baseMetrics = getRippleMetrics(totalWidth, totalHeight);
        const amplitude = baseMetrics.amplitude * strength;
        const { wavelength } = baseMetrics;

        let cursorX = margin;
        images.forEach((item, index) => {
            const y = margin + (maxHeight - item.height) / 2;
            const leftEdge = showWave && index > 0
                ? createEdge({
                    orientation: 'vertical',
                    x: cursorX,
                    from: margin,
                    to: totalHeight - margin,
                    amplitude,
                    wavelength
                })
                : null;
            const rightEdge = showWave && index < images.length - 1
                ? createEdge({
                    orientation: 'vertical',
                    x: cursorX + item.width,
                    from: margin,
                    to: totalHeight - margin,
                    amplitude,
                    wavelength
                })
                : null;

            if (rightEdge) seamShadows.push(rightEdge);

            placements.push({
                img: item.img,
                x: cursorX,
                y,
                width: item.width,
                height: item.height,
                leftEdge,
                rightEdge
            });

            cursorX += item.width + gap;
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
                        amplitude,
                        wavelength
                    })
                    : null;
                const topEdge = showWave && !isFirstRow && row.length > 0
                    ? createEdge({
                        orientation: 'horizontal',
                        y: seamY,
                        from: margin,
                        to: totalWidth - margin,
                        amplitude,
                        wavelength
                    })
                    : null;
                const bottomEdge = showWave && isFirstRow && row2.length > 0
                    ? createEdge({
                        orientation: 'horizontal',
                        y: seamY,
                        from: margin,
                        to: totalWidth - margin,
                        amplitude,
                        wavelength
                    })
                    : null;

                if (leftEdge) seamShadows.push(leftEdge);

                placements.push({
                    img: item.img,
                    x,
                    y,
                    width: item.width,
                    height: item.height,
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
            // One continuous seam shadow between the two rows.
            seamShadows.push(createEdge({
                orientation: 'horizontal',
                y: seamY,
                from: margin,
                to: totalWidth - margin,
                amplitude,
                wavelength
            }));
        }

        return { totalWidth, totalHeight, placements, seamShadows, gap, margin };
    }

    // Vertical (default)
    const maxWidth = maxOf(images, 'width');
    const totalWidth = maxWidth + margin * 2;
    const totalHeight = images.reduce((sum, item) => sum + item.height, 0) + gap * (images.length - 1) + margin * 2;
    const baseMetrics = getRippleMetrics(totalWidth, totalHeight);
    const amplitude = baseMetrics.amplitude * strength;
    const { wavelength } = baseMetrics;

    let cursorY = margin;
    images.forEach((item, index) => {
        const x = margin + (maxWidth - item.width) / 2;
        const y = cursorY;
        // Shared phase origin across the whole seam so mixed-width images
        // still meet on one continuous wave.
        const topEdge = showWave && index > 0
            ? createEdge({
                orientation: 'horizontal',
                y,
                from: margin,
                to: totalWidth - margin,
                amplitude,
                wavelength
            })
            : null;
        const bottomEdge = showWave && index < images.length - 1
            ? createEdge({
                orientation: 'horizontal',
                y: y + item.height,
                from: margin,
                to: totalWidth - margin,
                amplitude,
                wavelength
            })
            : null;

        if (bottomEdge) seamShadows.push(bottomEdge);

        placements.push({
            img: item.img,
            x,
            y,
            width: item.width,
            height: item.height,
            topEdge,
            bottomEdge
        });

        cursorY += item.height + gap;
    });

    return { totalWidth, totalHeight, placements, seamShadows, gap, margin };
};
