import { useEffect, useRef, useState } from 'react';
import './StitchCanvas.css';

const StitchCanvas = ({ images, settings, onDirectionChange }) => {
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

                if (direction === 'horizontal') {
                    totalWidth = loadedImages.reduce((sum, img) => sum + img.width, 0) + (gap * (loadedImages.length - 1));
                    totalHeight = Math.max(...loadedImages.map(img => img.height));
                } else if (direction === 'vertical') {
                    totalWidth = Math.max(...loadedImages.map(img => img.width));
                    totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0) + (gap * (loadedImages.length - 1));
                } else if (direction === 'collage') {
                    // 2 rows, 3 images per row
                    const row1 = loadedImages.slice(0, 3);
                    const row2 = loadedImages.slice(3, 6);

                    const row1Width = row1.reduce((sum, img) => sum + img.width, 0) + (gap * Math.max(0, row1.length - 1));
                    const row1Height = row1.length > 0 ? Math.max(...row1.map(img => img.height)) : 0;

                    const row2Width = row2.reduce((sum, img) => sum + img.width, 0) + (gap * Math.max(0, row2.length - 1));
                    const row2Height = row2.length > 0 ? Math.max(...row2.map(img => img.height)) : 0;

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

                loadedImages.forEach((img, index) => {
                    if (direction === 'horizontal') {
                        // Center vertically if heights differ
                        const yOffset = (totalHeight - img.height) / 2;
                        ctx.drawImage(img, currentX, yOffset);
                        currentX += img.width + gap;
                    } else if (direction === 'vertical') {
                        // Center horizontally if widths differ
                        const xOffset = (totalWidth - img.width) / 2;
                        ctx.drawImage(img, xOffset, currentY);
                        currentY += img.height + gap;
                    } else if (direction === 'collage') {
                        // Determine which row this image belongs to
                        const isRow1 = index < 3;
                        const rowImages = isRow1 ? loadedImages.slice(0, 3) : loadedImages.slice(3, 6);
                        const rowIndex = isRow1 ? index : index - 3;

                        // Calculate row height for vertical centering within the row
                        const rowHeight = Math.max(...rowImages.map(i => i.height));

                        // Calculate Y position
                        let yPos = 0;
                        if (!isRow1) {
                            const row1Height = Math.max(...loadedImages.slice(0, 3).map(i => i.height));
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
                        const yOffset = yPos + (rowHeight - img.height) / 2;

                        // Center the row horizontally in the total width?
                        // For now, let's just align left. To center the row:
                        const rowWidth = rowImages.reduce((sum, i) => sum + i.width, 0) + (gap * (rowImages.length - 1));
                        const rowXOffset = (totalWidth - rowWidth) / 2;

                        ctx.drawImage(img, xPos + rowXOffset, yOffset);
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
            <div className="canvas-wrapper">
                <canvas ref={canvasRef} style={{ display: 'none' }} />
                {canvasUrl ? (
                    <img src={canvasUrl} alt="Stitched Result" className="result-image" />
                ) : (
                    <div className="loading">拼接中...</div>
                )}
            </div>

            <div className="actions">
                <div className="setting-group" style={{ marginRight: 'auto' }}>

                    <div className="toggle-group">
                        <button
                            className={settings.direction === 'horizontal' ? 'active' : ''}
                            onClick={() => onDirectionChange('horizontal')}
                        >
                            横向
                        </button>
                        <button
                            className={settings.direction === 'vertical' ? 'active' : ''}
                            onClick={() => onDirectionChange('vertical')}
                        >
                            纵向
                        </button>
                        <button
                            className={settings.direction === 'collage' ? 'active' : ''}
                            onClick={() => onDirectionChange('collage')}
                        >
                            网格
                        </button>
                    </div>
                </div>

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
