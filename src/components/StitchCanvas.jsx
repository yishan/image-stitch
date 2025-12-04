import { useEffect, useRef, useState } from 'react';
import './StitchCanvas.css';

const StitchCanvas = ({ images, settings }) => {
    const canvasRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [canvasUrl, setCanvasUrl] = useState(null);

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
                } else {
                    totalWidth = Math.max(...loadedImages.map(img => img.width));
                    totalHeight = loadedImages.reduce((sum, img) => sum + img.height, 0) + (gap * (loadedImages.length - 1));
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
                    } else {
                        // Center horizontally if widths differ
                        const xOffset = (totalWidth - img.width) / 2;
                        ctx.drawImage(img, xOffset, currentY);
                        currentY += img.height + gap;
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
                alert('图片已复制到剪贴板！');
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
                <button className="action-btn secondary" onClick={handleCopy} disabled={!canvasUrl}>
                    复制到剪贴板
                </button>
                <button className="action-btn primary" onClick={handleDownload} disabled={!canvasUrl}>
                    下载图片
                </button>
            </div>
        </div>
    );
};

export default StitchCanvas;
