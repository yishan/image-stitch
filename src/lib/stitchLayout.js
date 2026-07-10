const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

const normalizeImages = (loadedImages, direction) => {
    let processedImages = loadedImages.map(img => ({
        img,
        width: img.width,
        height: img.height,
        original: img
    }));

    if (direction === 'horizontal') {
        const maxHeight = Math.max(...loadedImages.map(img => img.height));
        processedImages = processedImages.map(item => {
            const scaleFactor = maxHeight / item.height;

            return {
                ...item,
                width: item.width * scaleFactor,
                height: maxHeight
            };
        });
    } else if (direction === 'vertical' || direction === 'collage') {
        const maxWidth = Math.max(...loadedImages.map(img => img.width));
        processedImages = processedImages.map(item => {
            const scaleFactor = maxWidth / item.width;

            return {
                ...item,
                width: maxWidth,
                height: item.height * scaleFactor
            };
        });
    }

    return processedImages;
};

const getCanvasDimensions = (processedImages, direction) => {
    if (direction === 'horizontal') {
        return {
            totalWidth: processedImages.reduce((sum, item) => sum + item.width, 0),
            totalHeight: Math.max(...processedImages.map(item => item.height))
        };
    }

    if (direction === 'collage') {
        const splitIndex = processedImages.length === 4 ? 2 : 3;
        const row1 = processedImages.slice(0, splitIndex);
        const row2 = processedImages.slice(splitIndex, splitIndex * 2);

        const row1Width = row1.reduce((sum, item) => sum + item.width, 0);
        const row1Height = row1.length > 0 ? Math.max(...row1.map(item => item.height)) : 0;
        const row2Width = row2.reduce((sum, item) => sum + item.width, 0);
        const row2Height = row2.length > 0 ? Math.max(...row2.map(item => item.height)) : 0;

        return {
            totalWidth: Math.max(row1Width, row2Width),
            totalHeight: row1Height + row2Height
        };
    }

    return {
        totalWidth: Math.max(...processedImages.map(item => item.width)),
        totalHeight: processedImages.reduce((sum, item) => sum + item.height, 0)
    };
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

export const createStitchPlan = (loadedImages, settings = {}) => {
    if (!loadedImages || loadedImages.length === 0) {
        return {
            totalWidth: 0,
            totalHeight: 0,
            placements: [],
            seamShadows: []
        };
    }

    const direction = settings.direction || 'vertical';
    const showWave = settings.showWave !== false;
    const processedImages = normalizeImages(loadedImages, direction);
    const { totalWidth, totalHeight } = getCanvasDimensions(processedImages, direction);
    const { amplitude, wavelength } = getRippleMetrics(totalWidth, totalHeight);
    const placements = [];
    const seamShadows = [];
    let currentX = 0;
    let currentY = 0;

    processedImages.forEach((item, index) => {
        const img = item.original;
        const drawWidth = item.width;
        const drawHeight = item.height;

        if (direction === 'horizontal') {
            const yOffset = (totalHeight - drawHeight) / 2;
            const leftEdge = showWave && index > 0
                ? createEdge({
                    orientation: 'vertical',
                    x: currentX,
                    from: yOffset,
                    amplitude,
                    wavelength
                })
                : null;
            const rightEdge = showWave && index < processedImages.length - 1
                ? createEdge({
                    orientation: 'vertical',
                    x: currentX + drawWidth,
                    from: yOffset,
                    to: yOffset + drawHeight,
                    amplitude,
                    wavelength
                })
                : null;

            if (rightEdge) {
                seamShadows.push(rightEdge);
            }

            placements.push({
                img,
                x: currentX,
                y: yOffset,
                width: drawWidth,
                height: drawHeight,
                leftEdge,
                rightEdge
            });

            currentX += drawWidth;
        } else if (direction === 'vertical') {
            const xOffset = (totalWidth - drawWidth) / 2;
            const topEdge = showWave && index > 0
                ? createEdge({
                    orientation: 'horizontal',
                    y: currentY,
                    from: xOffset,
                    amplitude,
                    wavelength
                })
                : null;
            const bottomEdge = showWave && index < processedImages.length - 1
                ? createEdge({
                    orientation: 'horizontal',
                    y: currentY + drawHeight,
                    from: xOffset,
                    to: xOffset + drawWidth,
                    amplitude,
                    wavelength
                })
                : null;

            if (bottomEdge) {
                seamShadows.push(bottomEdge);
            }

            placements.push({
                img,
                x: xOffset,
                y: currentY,
                width: drawWidth,
                height: drawHeight,
                topEdge,
                bottomEdge
            });

            currentY += drawHeight;
        } else if (direction === 'collage') {
            const splitIndex = processedImages.length === 4 ? 2 : 3;
            const isRow1 = index < splitIndex;
            const rowImages = isRow1
                ? processedImages.slice(0, splitIndex)
                : processedImages.slice(splitIndex, splitIndex * 2);
            const rowIndex = isRow1 ? index : index - splitIndex;
            const rowHeight = Math.max(...rowImages.map(i => i.height));
            const row1Images = processedImages.slice(0, splitIndex);
            const row1Height = processedImages.length > splitIndex
                ? Math.max(...row1Images.map(i => i.height))
                : 0;
            const yPos = isRow1 ? 0 : row1Height;

            let xPos = 0;
            for (let i = 0; i < rowIndex; i++) {
                xPos += rowImages[i].width;
            }

            const yOffset = yPos + (rowHeight - drawHeight) / 2;
            const rowWidth = rowImages.reduce((sum, i) => sum + i.width, 0);
            const rowXOffset = (totalWidth - rowWidth) / 2;
            const x = xPos + rowXOffset;
            const leftEdge = showWave && rowIndex > 0
                ? createEdge({
                    orientation: 'vertical',
                    x,
                    from: yPos,
                    amplitude,
                    wavelength
                })
                : null;
            const rightEdge = showWave && rowIndex < rowImages.length - 1
                ? createEdge({
                    orientation: 'vertical',
                    x: x + drawWidth,
                    from: yPos,
                    to: yPos + rowHeight,
                    amplitude,
                    wavelength
                })
                : null;
            const topEdge = showWave && !isRow1
                ? createEdge({
                    orientation: 'horizontal',
                    y: row1Height,
                    from: 0,
                    amplitude,
                    wavelength
                })
                : null;
            const bottomEdge = showWave && isRow1 && processedImages.length > splitIndex
                ? createEdge({
                    orientation: 'horizontal',
                    y: row1Height,
                    from: 0,
                    to: totalWidth,
                    amplitude,
                    wavelength
                })
                : null;

            if (rightEdge) {
                seamShadows.push(rightEdge);
            }

            if (bottomEdge && rowIndex === 0) {
                seamShadows.push(bottomEdge);
            }

            placements.push({
                img,
                x,
                y: yOffset,
                width: drawWidth,
                height: drawHeight,
                topEdge,
                rightEdge,
                bottomEdge,
                leftEdge
            });
        }
    });

    return {
        totalWidth,
        totalHeight,
        placements,
        seamShadows
    };
};
