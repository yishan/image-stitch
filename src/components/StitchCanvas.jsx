import { useEffect, useRef, useState } from 'react';
import { canvasToBlob, loadImagesForRender, releaseRenderableImages, renderStitch } from '../lib/stitchRenderer.js';
import './StitchCanvas.css';

const StitchCanvas = ({ images, settings, onSettingsChange }) => {
    const canvasRef = useRef(null);
    const generationRef = useRef(0);
    const outputUrlRef = useRef(null);
    const copyTimerRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [canvasUrl, setCanvasUrl] = useState(null);
    const [error, setError] = useState('');
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
        setError('');
        setIsGenerating(true);

        const isCurrentGeneration = () => !cancelled && generation === generationRef.current;

        const generateImage = async () => {
            let loadedImages = [];

            try {
                loadedImages = await loadImagesForRender(images);
                if (!isCurrentGeneration()) return;

                const canvas = canvasRef.current;
                if (!canvas) throw new Error('拼接画布未准备完成，请重试。');

                renderStitch(canvas, loadedImages, settings);
                const blob = await canvasToBlob(canvas);
                if (!isCurrentGeneration()) return;

                const nextUrl = URL.createObjectURL(blob);
                outputUrlRef.current = nextUrl;
                setCanvasUrl(nextUrl);
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
        link.download = `stitched-image-${Date.now()}.png`;
        link.href = canvasUrl;
        link.click();
    };

    const handleCopy = async () => {
        if (!canvasRef.current) return;

        try {
            if (!navigator.clipboard?.write || !window.ClipboardItem) {
                throw new Error('当前浏览器不支持复制图片。');
            }

            const blob = await canvasToBlob(canvasRef.current);
            await navigator.clipboard.write([
                new window.ClipboardItem({ [blob.type]: blob })
            ]);
            setIsCopied(true);
            if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
            copyTimerRef.current = window.setTimeout(() => setIsCopied(false), 1500);
        } catch (copyError) {
            setError(copyError.message || '复制图片失败，请改用下载。');
        }
    };

    const showWave = settings.showWave !== false;

    return (
        <div className="stitch-container">
            <div className="controls-header">
                <div className="setting-group" role="group" aria-label="拼接设置">
                    <div className="toggle-group" role="group" aria-label="拼接方向">
                        {[
                            ['horizontal', '横向'],
                            ['vertical', '纵向'],
                            ['collage', '网格']
                        ].map(([direction, label]) => (
                            <button
                                key={direction}
                                type="button"
                                className={settings.direction === direction ? 'active' : ''}
                                aria-pressed={settings.direction === direction}
                                onClick={() => onSettingsChange((previous) => ({ ...previous, direction }))}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <label className="wave-control">
                        <input
                            type="checkbox"
                            checked={showWave}
                            onChange={(event) => onSettingsChange((previous) => ({
                                ...previous,
                                showWave: event.target.checked
                            }))}
                        />
                        <span>分隔线</span>
                    </label>
                </div>
            </div>

            <div className="canvas-wrapper" aria-live="polite">
                <canvas ref={canvasRef} className="hidden-canvas" />
                {isGenerating && <div className="loading">拼接中...</div>}
                {!isGenerating && error && (
                    <div className="canvas-error" role="alert">
                        <p>{error}</p>
                        <button type="button" onClick={() => setRetryKey((value) => value + 1)}>重试</button>
                    </div>
                )}
                {!isGenerating && !error && canvasUrl && (
                    <img src={canvasUrl} alt="拼接结果预览" className="result-image" />
                )}
            </div>

            <div className="actions">
                <button
                    type="button"
                    className={`action-btn secondary ${isCopied ? 'copied' : ''}`}
                    onClick={handleCopy}
                    disabled={!canvasUrl || isGenerating}
                >
                    {isCopied ? (
                        <>
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            已复制
                        </>
                    ) : '复制'}
                </button>
                <button type="button" className="action-btn primary" onClick={handleDownload} disabled={!canvasUrl || isGenerating}>
                    下载
                </button>
            </div>
        </div>
    );
};

export default StitchCanvas;
