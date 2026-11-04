import { useEffect, useRef, useState } from 'react';
import { canvasToBlob, loadImagesForRender, releaseRenderableImages, renderStitch } from '../lib/stitchRenderer.js';
import './StitchCanvas.css';

const DIRECTION_LABELS = [
    ['horizontal', '横向'],
    ['vertical', '纵向'],
    ['collage', '网格']
];

const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const downloadStamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
};

const CheckIcon = () => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const DownloadIcon = () => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M8 2.5v8m0 0L4.75 7.25M8 10.5l3.25-3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.5 12.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const AlertIcon = () => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
);

const StitchCanvas = ({ images, settings, onSettingsChange }) => {
    const canvasRef = useRef(null);
    const generationRef = useRef(0);
    const outputUrlRef = useRef(null);
    const copyTimerRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [canvasUrl, setCanvasUrl] = useState(null);
    const [output, setOutput] = useState(null);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => () => {
        generationRef.current += 1;
        if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    }, []);

    useEffect(() => {
        if (images.length === 0) return undefined;

        let cancelled = false;
        const generation = ++generationRef.current;

        if (outputUrlRef.current) {
            URL.revokeObjectURL(outputUrlRef.current);
            outputUrlRef.current = null;
        }
        setCanvasUrl(null);
        setOutput(null);
        setError('');
        setActionMessage('');
        setIsGenerating(true);

        const isCurrentGeneration = () => !cancelled && generation === generationRef.current;

        const generateImage = async () => {
            let loadedImages = [];

            try {
                loadedImages = await loadImagesForRender(images);
                if (!isCurrentGeneration()) return;

                const canvas = canvasRef.current;
                if (!canvas) throw new Error('拼接画布未准备完成，请重试。');

                const plan = renderStitch(canvas, loadedImages, settings);
                const blob = await canvasToBlob(canvas);
                if (!isCurrentGeneration()) return;

                const nextUrl = URL.createObjectURL(blob);
                outputUrlRef.current = nextUrl;
                setCanvasUrl(nextUrl);
                setOutput({
                    width: plan.width,
                    height: plan.height,
                    scale: plan.scale,
                    bytes: blob.size
                });
            } catch (generationError) {
                if (isCurrentGeneration()) {
                    setError(generationError.message || '拼接失败，请检查图片后重试。');
                }
            } finally {
                releaseRenderableImages(loadedImages);
                if (isCurrentGeneration()) setIsGenerating(false);
            }
        };

        generateImage();

        return () => {
            cancelled = true;
            if (generationRef.current === generation) generationRef.current += 1;
        };
    }, [images, settings, retryKey]);

    const handleDownload = () => {
        if (!canvasUrl) return;
        const link = document.createElement('a');
        link.download = `stitch-${settings.direction}-${downloadStamp()}.png`;
        link.href = canvasUrl;
        link.click();
    };

    const handleCopy = async () => {
        if (!canvasRef.current) return;

        try {
            if (!navigator.clipboard?.write || !window.ClipboardItem) {
                throw new Error('当前浏览器不支持复制图片，请改用下载。');
            }

            const blob = await canvasToBlob(canvasRef.current);
            await navigator.clipboard.write([
                new window.ClipboardItem({ [blob.type]: blob })
            ]);
            setIsCopied(true);
            setActionMessage('');
            if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
            copyTimerRef.current = window.setTimeout(() => setIsCopied(false), 1500);
        } catch (copyError) {
            // A clipboard failure must not replace the finished preview.
            setActionMessage(copyError.message || '复制图片失败，请改用下载。');
        }
    };

    const showWave = settings.showWave !== false;
    const hasResult = !isGenerating && !error && canvasUrl;
    const sizeLabel = output
        ? [formatBytes(output.bytes), output.scale < 1 ? '已按上限缩放' : ''].filter(Boolean).join(' · ')
        : '';

    return (
        <div className="stitch">
            <div className="stitch-toolbar">
                <div className="segmented" role="group" aria-label="拼接方向">
                    {DIRECTION_LABELS.map(([direction, label]) => (
                        <button
                            key={direction}
                            type="button"
                            className={settings.direction === direction ? 'is-active' : ''}
                            aria-pressed={settings.direction === direction}
                            onClick={() => onSettingsChange((previous) => ({ ...previous, direction }))}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <label className="seam">
                    <input
                        type="checkbox"
                        checked={showWave}
                        onChange={(event) => onSettingsChange((previous) => ({
                            ...previous,
                            showWave: event.target.checked
                        }))}
                    />
                    <span className="seam-box" aria-hidden="true">
                        <svg viewBox="0 0 16 10" fill="none" focusable="false">
                            <path d="M1 5q2-4 4 0t4 0t4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                    </span>
                    <span className="seam-label">波浪接缝</span>
                </label>
            </div>

            <div className="stage" aria-busy={isGenerating}>
                <canvas ref={canvasRef} className="hidden-canvas" />
                <div className="stage-ticks" aria-hidden="true">
                    <span /><span /><span /><span />
                </div>

                {isGenerating && (
                    <div className="stage-status">
                        <span className="stage-progress" aria-hidden="true"><span /></span>
                        <p>正在拼接…</p>
                    </div>
                )}

                {!isGenerating && error && (
                    <div className="stage-error" role="alert">
                        <AlertIcon />
                        <p>{error}</p>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setRetryKey((value) => value + 1)}>
                            重试
                        </button>
                    </div>
                )}

                {hasResult && (
                    <img
                        src={canvasUrl}
                        alt={output ? `拼接结果预览，${output.width} × ${output.height} 像素` : '拼接结果预览'}
                        className="result-image"
                        width={output.width}
                        height={output.height}
                    />
                )}
            </div>

            <div className="stitch-actions">
                <p className="output-meta">
                    <span className="output-meta__label">输出</span>
                    {output ? (
                        <span className="output-meta__value mono">
                            {output.width} × {output.height} px
                        </span>
                    ) : (
                        <span className="output-meta__value is-empty mono">—</span>
                    )}
                    {sizeLabel && <span className="output-meta__size mono">{sizeLabel}</span>}
                </p>

                <p className="visually-hidden" role="status" aria-live="polite">
                    {isGenerating
                        ? '正在拼接'
                        : hasResult && output
                            ? `拼接完成，${output.width} × ${output.height} 像素`
                            : ''}
                </p>

                <p className="visually-hidden" role="status" aria-live="polite">
                    {actionMessage}
                </p>
                {actionMessage && <p className="action-message" aria-hidden="true">{actionMessage}</p>}

                <div className="action-buttons">
                    <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={handleCopy}
                        disabled={!hasResult}
                    >
                        {isCopied ? (
                            <>
                                <CheckIcon />
                                已复制
                            </>
                        ) : '复制图片'}
                    </button>
                    <span className="visually-hidden" aria-live="polite">
                        {isCopied ? '已复制到剪贴板' : ''}
                    </span>
                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={handleDownload}
                        disabled={!hasResult}
                    >
                        <DownloadIcon />
                        下载 PNG
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StitchCanvas;
