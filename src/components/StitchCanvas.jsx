import { useEffect, useRef, useState } from 'react';
import './StitchCanvas.css';

const StitchCanvas = ({ images, settings, onSettingsChange }) => {
    const canvasRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [canvasUrl, setCanvasUrl] = useState(null);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        if (images.length === 0) return;

        const generateImage = async () => {
            setIsGenerating(true);

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
                const { direction, gap, backgroundColor, scale } = settings;
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
                    totalWidth = processedImages.reduce((sum, item) => sum + item.width, 0) + (gap * (processedImages.length - 1));
                    totalHeight = Math.max(...processedImages.map(item => item.height));
                } else if (direction === 'vertical') {
                    totalWidth = Math.max(...processedImages.map(item => item.width));
                    totalHeight = processedImages.reduce((sum, item) => sum + item.height, 0) + (gap * (processedImages.length - 1));
                } else if (direction === 'collage') {
                    // Determine split index: 2 for 4 images (2x2), 3 for others (3 per row)
                    const splitIndex = processedImages.length === 4 ? 2 : 3;

                    const row1 = processedImages.slice(0, splitIndex);
                    const row2 = processedImages.slice(splitIndex, splitIndex * 2);

                    const row1Width = row1.reduce((sum, item) => sum + item.width, 0) + (gap * Math.max(0, row1.length - 1));
                    const row1Height = row1.length > 0 ? Math.max(...row1.map(item => item.height)) : 0;

                    const row2Width = row2.reduce((sum, item) => sum + item.width, 0) + (gap * Math.max(0, row2.length - 1));
                    const row2Height = row2.length > 0 ? Math.max(...row2.map(item => item.height)) : 0;

                    totalWidth = Math.max(row1Width, row2Width);
                    totalHeight = row1Height + (row2.length > 0 ? gap : 0) + row2Height;
                }

                // Apply scale (optional, but good for performance if images are huge)
                // For now, we keep original resolution for quality, but display it smaller via CSS

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

                processedImages.forEach((item, index) => {
                    const img = item.original; // Use original image for drawing, but with calculated dimensions
                    const drawWidth = item.width;
                    const drawHeight = item.height;

                    if (direction === 'horizontal') {
                        // Center vertically if heights differ (though they should be same if sameDimension is true)
                        const yOffset = (totalHeight - drawHeight) / 2;
                        ctx.drawImage(img, currentX, yOffset, drawWidth, drawHeight);
                        currentX += drawWidth + gap;
                    } else if (direction === 'vertical') {
                        // Center horizontally if widths differ (though they should be same if sameDimension is true)
                        const xOffset = (totalWidth - drawWidth) / 2;
                        ctx.drawImage(img, xOffset, currentY, drawWidth, drawHeight);
                        currentY += drawHeight + gap;
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
                            yPos = row1Height + gap;
                        }

                        // Calculate X position
                        // We need to know the X position of this specific image in its row
                        // It depends on the widths of previous images in the same row
                        let xPos = 0;
                        for (let i = 0; i < rowIndex; i++) {
                            xPos += rowImages[i].width + gap;
                        }

                        // Center vertically within the row
                        const yOffset = yPos + (rowHeight - drawHeight) / 2;

                        // Center the row horizontally in the total width?
                        // For now, let's just align left. To center the row:
                        const rowWidth = rowImages.reduce((sum, i) => sum + i.width, 0) + (gap * (rowImages.length - 1));
                        const rowXOffset = (totalWidth - rowWidth) / 2;

                        ctx.drawImage(img, xPos + rowXOffset, yOffset, drawWidth, drawHeight);
                    }
                });

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

                    <div className="gap-control">
                        <label>间距: {settings.gap}px</label>
                        <input
                            type="range"
                            min="0"
                            max="20"
                            step="2"
                            value={settings.gap}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val >= 0 && val <= 20) {
                                    onSettingsChange(prev => ({ ...prev, gap: val }));
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="canvas-wrapper">
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                {canvasUrl ? (
                    <img src={canvasUrl} alt="Stitched Result" className="result-image" />
                ) : (
                    <div className="loading">拼接中...</div>
                )}
            </div>

            <div className="actions">
                <button
                    className={`action-btn secondary ${isCopied ? 'copied' : ''}`}
                    onClick={handleCopy}
                    disabled={!canvasUrl}
                >
                    {isCopied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    ) : '复制'}
                </button>
                <button className="action-btn primary" onClick={handleDownload} disabled={!canvasUrl}>
                    下载
                </button>
            </div>
        </div>
    );
};

export default StitchCanvas;
