import { useEffect, useRef, useState } from 'react';
import { createStitchPlan, getWaveOffset } from '../lib/stitchLayout';
import './StitchCanvas.css';

const traceWaveLine = (ctx, seam, offset = 0) => {
    const { orientation, x, y, from, to, amplitude, wavelength } = seam;
    const step = 4;

    ctx.beginPath();

    for (let pos = from; pos <= to; pos += step) {
        const waveOffset = getWaveOffset(pos, from, amplitude, wavelength);
        const pointX = orientation === 'vertical' ? x + waveOffset + offset : pos;
        const pointY = orientation === 'vertical' ? pos : y + waveOffset + offset;

        if (pos === from) {
            ctx.moveTo(pointX, pointY);
        } else {
            ctx.lineTo(pointX, pointY);
        }
    }

    const finalWaveOffset = getWaveOffset(to, from, amplitude, wavelength);
    ctx.lineTo(
        orientation === 'vertical' ? x + finalWaveOffset + offset : to,
        orientation === 'vertical' ? to : y + finalWaveOffset + offset
    );
};

const drawRippleSeamShadows = (ctx, seams, totalWidth, totalHeight) => {
    if (seams.length === 0) return;

    const baseSize = Math.min(totalWidth, totalHeight);
    const lineWidth = Math.min(Math.max(baseSize * 0.0018, 1), 2.5);
    const offset = 1.7;

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
        const y = edge
            ? edge.y + getWaveOffset(x, edge.from, edge.amplitude, edge.wavelength)
            : edge?.fallbackY;
        ctx.lineTo(x, y);
    }

    if ((reverse && start !== end) || (!reverse && start !== end)) {
        const finalY = edge
            ? edge.y + getWaveOffset(end, edge.from, edge.amplitude, edge.wavelength)
            : edge?.fallbackY;
        ctx.lineTo(end, finalY);
    }
};

const addVerticalEdge = (ctx, edge, top, bottom, reverse = false) => {
    const step = 4;
    const start = reverse ? bottom : top;
    const end = reverse ? top : bottom;
    const direction = reverse ? -step : step;

    for (let y = start; reverse ? y >= end : y <= end; y += direction) {
        const x = edge
            ? edge.x + getWaveOffset(y, edge.from, edge.amplitude, edge.wavelength)
            : edge?.fallbackX;
        ctx.lineTo(x, y);
    }

    if ((reverse && start !== end) || (!reverse && start !== end)) {
        const finalX = edge
            ? edge.x + getWaveOffset(end, edge.from, edge.amplitude, edge.wavelength)
            : edge?.fallbackX;
        ctx.lineTo(finalX, end);
    }
};

const createImageClipPath = (ctx, placement) => {
    const { x, y, width, height, topEdge, rightEdge, bottomEdge, leftEdge } = placement;
    const topY = y;
    const rightX = x + width;
    const bottomY = y + height;
    const leftX = x;

    ctx.beginPath();
    ctx.moveTo(leftX, topEdge ? topEdge.y + getWaveOffset(leftX, topEdge.from, topEdge.amplitude, topEdge.wavelength) : topY);

    if (topEdge) {
        addHorizontalEdge(ctx, topEdge, leftX, rightX);
    } else {
        ctx.lineTo(rightX, topY);
    }

    if (rightEdge) {
        addVerticalEdge(ctx, rightEdge, topY, bottomY);
    } else {
        ctx.lineTo(rightX, bottomY);
    }

    if (bottomEdge) {
        addHorizontalEdge(ctx, bottomEdge, leftX, rightX, true);
    } else {
        ctx.lineTo(leftX, bottomY);
    }

    if (leftEdge) {
        addVerticalEdge(ctx, leftEdge, topY, bottomY, true);
    } else {
        ctx.lineTo(leftX, topY);
    }

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
        ctx.drawImage(
            placement.img,
            placement.x,
            placement.y,
            placement.width,
            placement.height
        );
    });
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

                const { backgroundColor } = settings;
                const {
                    totalWidth,
                    totalHeight,
                    placements,
                    seamShadows
                } = createStitchPlan(loadedImages, settings);

                const canvas = canvasRef.current;
                canvas.width = totalWidth;
                canvas.height = totalHeight;
                const ctx = canvas.getContext('2d');

                // Fill background
                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, totalWidth, totalHeight);

                if (settings.showWave === false) {
                    drawDirectStitchedImages(ctx, placements);
                } else {
                    drawRippleStitchedImages(ctx, placements);
                    drawRippleSeamShadows(ctx, seamShadows, totalWidth, totalHeight);
                }

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

    const showWave = settings.showWave !== false;

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

                    <label className="wave-control">
                        <input
                            type="checkbox"
                            checked={showWave}
                            onChange={(e) => onSettingsChange(prev => ({
                                ...prev,
                                showWave: e.target.checked
                            }))}
                        />
                        <span>分隔线</span>
                    </label>
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
