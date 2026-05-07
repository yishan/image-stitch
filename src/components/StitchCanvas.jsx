import { useEffect, useRef, useState } from 'react';
import './StitchCanvas.css';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const drawWavePath = (ctx, seam) => {
    const { orientation, x, y, from, to, amplitude, wavelength } = seam;
    const step = 4;

    ctx.beginPath();

    for (let pos = from; pos <= to; pos += step) {
        const waveOffset = Math.sin(((pos - from) / wavelength) * Math.PI * 2) * amplitude;
        const pointX = orientation === 'vertical' ? x + waveOffset : pos;
        const pointY = orientation === 'vertical' ? pos : y + waveOffset;

        if (pos === from) {
            ctx.moveTo(pointX, pointY);
        } else {
            ctx.lineTo(pointX, pointY);
        }
    }

    ctx.stroke();
};

const drawWaveSeams = (ctx, seams, totalWidth, totalHeight, seamThicknessSetting) => {
    if (seams.length === 0) return;

    const seamThickness = clamp(Number(seamThicknessSetting) || 2, 1, 3);
    const baseSize = Math.min(totalWidth, totalHeight);
    const baseLineWidth = clamp(baseSize * 0.0025, 2, 4);
    const lineWidth = baseLineWidth + ((seamThickness - 1) * 2);
    const amplitude = lineWidth * 1.45;
    const wavelength = lineWidth * 7;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    seams.forEach((seam) => {
        const waveSeam = { ...seam, amplitude, wavelength };

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = lineWidth + 2;
        drawWavePath(ctx, waveSeam);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = lineWidth;
        drawWavePath(ctx, waveSeam);
    });

    ctx.restore();
};

const StitchCanvas = ({ images, settings, onSettingsChange }) => {
    const canvasRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [canvasUrl, setCanvasUrl] = useState(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (images.length === 0) return;

        const generateImage = async () => {
            setIsGenerating(true);
            setCanvasUrl(null);

            try {
                // Load all images
                const loadedImages = await Promise.all(
                    images.map(img => new Promise((resolve, reject) => {
                        const image = new Image();
                        image.onload = () => resolve(image);
                        image.onerror = reject;
                        image.src = img.url;
                    }))
                );

                // Calculate dimensions
                const { direction, backgroundColor, seamThickness = 2 } = settings;
                let totalWidth = 0;
                let totalHeight = 0;

                // Pre-process images for unified dimensions
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

                if (direction === 'horizontal') {
                    totalWidth = processedImages.reduce((sum, item) => sum + item.width, 0);
                    totalHeight = Math.max(...processedImages.map(item => item.height));
                } else if (direction === 'vertical') {
                    totalWidth = Math.max(...processedImages.map(item => item.width));
                    totalHeight = processedImages.reduce((sum, item) => sum + item.height, 0);
                } else if (direction === 'collage') {
                    // Determine split index: 2 for 4 images (2x2), 3 for others (3 per row)
                    const splitIndex = processedImages.length === 4 ? 2 : 3;

                    const row1 = processedImages.slice(0, splitIndex);
                    const row2 = processedImages.slice(splitIndex, splitIndex * 2);

                    const row1Width = row1.reduce((sum, item) => sum + item.width, 0);
                    const row1Height = row1.length > 0 ? Math.max(...row1.map(item => item.height)) : 0;

                    const row2Width = row2.reduce((sum, item) => sum + item.width, 0);
                    const row2Height = row2.length > 0 ? Math.max(...row2.map(item => item.height)) : 0;

                    totalWidth = Math.max(row1Width, row2Width);
                    totalHeight = row1Height + row2Height;
                }

                const canvas = canvasRef.current;
                canvas.width = totalWidth;
                canvas.height = totalHeight;
                const ctx = canvas.getContext('2d');

                // Fill background
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, totalWidth, totalHeight);

                // Draw images
                let currentX = 0;
                let currentY = 0;
                const seams = [];

                processedImages.forEach((item, index) => {
                    const img = item.original; // Use original image for drawing, but with calculated dimensions
                    const drawWidth = item.width;
                    const drawHeight = item.height;

                    if (direction === 'horizontal') {
                        // Center vertically if heights differ (though they should be same if sameDimension is true)
                        const yOffset = (totalHeight - drawHeight) / 2;
                        ctx.drawImage(img, currentX, yOffset, drawWidth, drawHeight);

                        if (index < processedImages.length - 1) {
                            seams.push({
                                orientation: 'vertical',
                                x: currentX + drawWidth,
                                from: yOffset,
                                to: yOffset + drawHeight
                            });
                        }

                        currentX += drawWidth;
                    } else if (direction === 'vertical') {
                        // Center horizontally if widths differ (though they should be same if sameDimension is true)
                        const xOffset = (totalWidth - drawWidth) / 2;
                        ctx.drawImage(img, xOffset, currentY, drawWidth, drawHeight);

                        if (index < processedImages.length - 1) {
                            seams.push({
                                orientation: 'horizontal',
                                y: currentY + drawHeight,
                                from: xOffset,
                                to: xOffset + drawWidth
                            });
                        }

                        currentY += drawHeight;
                    } else if (direction === 'collage') {
                        // Determine split index again for drawing
                        const splitIndex = processedImages.length === 4 ? 2 : 3;

                        // Determine which row this image belongs to
                        const isRow1 = index < splitIndex;
                        const rowImages = isRow1 ? processedImages.slice(0, splitIndex) : processedImages.slice(splitIndex, splitIndex * 2);
                        const rowIndex = isRow1 ? index : index - splitIndex;

                        // Calculate row height for vertical centering within the row
                        const rowHeight = Math.max(...rowImages.map(i => i.height));

                        // Calculate Y position
                        let yPos = 0;
                        if (!isRow1) {
                            const row1Height = Math.max(...processedImages.slice(0, splitIndex).map(i => i.height));
                            yPos = row1Height;
                        }

                        // Calculate X position
                        // We need to know the X position of this specific image in its row
                        // It depends on the widths of previous images in the same row
                        let xPos = 0;
                        for (let i = 0; i < rowIndex; i++) {
                            xPos += rowImages[i].width;
                        }

                        // Center vertically within the row
                        const yOffset = yPos + (rowHeight - drawHeight) / 2;

                        // Center the row horizontally in the total width?
                        // For now, let's just align left. To center the row:
                        const rowWidth = rowImages.reduce((sum, i) => sum + i.width, 0);
                        const rowXOffset = (totalWidth - rowWidth) / 2;

                        ctx.drawImage(img, xPos + rowXOffset, yOffset, drawWidth, drawHeight);

                        if (rowIndex < rowImages.length - 1) {
                            seams.push({
                                orientation: 'vertical',
                                x: rowXOffset + xPos + drawWidth,
                                from: yPos,
                                to: yPos + rowHeight
                            });
                        }

                        if (index === 0 && processedImages.length > splitIndex) {
                            const row1Height = Math.max(...processedImages.slice(0, splitIndex).map(i => i.height));
                            seams.push({
                                orientation: 'horizontal',
                                y: row1Height,
                                from: 0,
                                to: totalWidth
                            });
                        }
                    }
                });

                drawWaveSeams(ctx, seams, totalWidth, totalHeight, seamThickness);

                setCanvasUrl(canvas.toDataURL('image/png'));
            } catch (error) {
                console.error("Error stitching images:", error);
            } finally {
                setIsGenerating(false);
            }
        };

        generateImage();
    }, [images, settings]);

    const handleDownload = () => {
        if (!canvasUrl) return;
        const link = document.createElement('a');
        link.download = `stitched-image-${Date.now()}.png`;
        link.href = canvasUrl;
        link.click();
    };

    const handleCopy = async () => {
        if (!canvasRef.current) return;

        try {
            canvasRef.current.toBlob(async (blob) => {
                if (!blob) {
                    console.error('Canvas is empty');
                    return;
                }
                await navigator.clipboard.write([
                    new ClipboardItem({
                        [blob.type]: blob
                    })
                ]);
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 1500);
            });
        } catch (err) {
            console.error('Failed to copy: ', err);
            alert('复制图片失败。');
        }
    };

    if (images.length === 0) return null;

    const seamThickness = clamp(settings.seamThickness ?? 2, 1, 3);

    return (
        <div className="stitch-container">
            <div className="controls-header">
                <div className="setting-group">
                    <div className="toggle-group">
                        <button
                            className={settings.direction === 'horizontal' ? 'active' : ''}
                            onClick={() => onSettingsChange(prev => ({ ...prev, direction: 'horizontal' }))}
                        >
                            横向
                        </button>
                        <button
                            className={settings.direction === 'vertical' ? 'active' : ''}
                            onClick={() => onSettingsChange(prev => ({ ...prev, direction: 'vertical' }))}
                        >
                            纵向
                        </button>
                        <button
                            className={settings.direction === 'collage' ? 'active' : ''}
                            onClick={() => onSettingsChange(prev => ({ ...prev, direction: 'collage' }))}
                        >
                            网格
                        </button>
                    </div>

                    <div className="seam-control">
                        <label>粗度: {seamThickness}/3</label>
                        <input
                            type="range"
                            min="1"
                            max="3"
                            step="1"
                            value={seamThickness}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 1 && val <= 3) {
                                    onSettingsChange(prev => ({ ...prev, seamThickness: val }));
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="canvas-wrapper">
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                {canvasUrl && !isGenerating ? (
                    <img src={canvasUrl} alt="Stitched Result" className="result-image" />
                ) : (
                    <div className="loading">拼接中...</div>
                )}
            </div>

            <div className="actions">
                <button
                    className={`action-btn secondary ${isCopied ? 'copied' : ''}`}
                    onClick={handleCopy}
                    disabled={!canvasUrl || isGenerating}
                >
                    {isCopied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    ) : '复制'}
                </button>
                <button className="action-btn primary" onClick={handleDownload} disabled={!canvasUrl || isGenerating}>
                    下载
                </button>
            </div>
        </div>
    );
};

export default StitchCanvas;
