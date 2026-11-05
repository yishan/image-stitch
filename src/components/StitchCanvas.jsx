import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GRID_PRESETS, createStitchPlan } from '../lib/stitchLayout.js';
import {
    DEFAULT_EXPORT_SETTINGS,
    DEFAULT_OUTPUT_LIMITS,
    SAFE_CANVAS_AREA,
    canvasToBlob,
    clearRenderCache,
    getExportDimensions,
    getExportFormat,
    getExportSupport,
    getSafeMaxPixels,
    loadImagesForRender,
    pruneRenderCache,
    renderStitch
} from '../lib/stitchRenderer.js';
import { isEditableTarget } from '../lib/keyboard.js';
import { canvasToPdfBlob, getSliceRanges, sliceCanvasToBlobs, sliceFilename } from '../lib/exportSlices.js';
import { DEFAULT_REDACTION_COLOR, applyRedactions } from '../lib/redaction.js';
import { ChevronIcon, CheckIcon, DownloadIcon } from './ui-icons.jsx';
import StitchSettings from './StitchSettings.jsx';
import StitchStage from './StitchStage.jsx';
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
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const StitchCanvas = ({ images, settings, onSettingsChange, onResetSettings, sessionStatus, onClearSession }) => {
    const canvasRef = useRef(null);
    const generationRef = useRef(0);
    const outputUrlRef = useRef(null);
    const copyTimerRef = useRef(null);
    const advancedRef = useRef(null);
    const [sourceImages, setSourceImages] = useState(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [canvasUrl, setCanvasUrl] = useState(null);
    const [output, setOutput] = useState(null);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [retryKey, setRetryKey] = useState(0);
    const [redactions, setRedactions] = useState([]);
    const [redactMode, setRedactMode] = useState(false);
    const [redactionMode, setRedactionMode] = useState('mosaic');
    const [redactionColor, setRedactionColor] = useState(DEFAULT_REDACTION_COLOR);

    const exportSettings = settings.export || DEFAULT_EXPORT_SETTINGS;
    const format = getExportFormat(exportSettings.format);
    const support = getExportSupport();
    const showWave = settings.showWave !== false;
    const previewMode = settings.previewMode === 'width' ? 'width' : 'fit';
    const gridDirect = settings.direction === 'collage' && (settings.gridPreset || 'auto') !== 'auto';
    const qualityValue = Math.round((exportSettings.quality ?? DEFAULT_EXPORT_SETTINGS.quality) * 100);
    const sliceHeight = Number(exportSettings.sliceHeight) || 0;
    const isCustomized = (
        settings.gap > 0
        || settings.margin > 0
        || settings.radius > 0
        || settings.backgroundColor !== 'transparent'
        || settings.seamStrength !== 'regular'
        || exportSettings.format !== 'png'
        || exportSettings.sizeMode !== 'auto'
        || exportSettings.quality !== DEFAULT_EXPORT_SETTINGS.quality
        || sliceHeight > 0
        || previewMode !== 'fit'
        || (settings.gridPreset || 'auto') !== 'auto'
    );

    useEffect(() => {
        if (!isSettingsOpen) return undefined;

        const close = () => {
            const node = advancedRef.current;
            if (!node) return;
            node.open = false;
            setIsSettingsOpen(false);
            node.querySelector('summary')?.focus();
        };
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };
        const handlePointerDown = (event) => {
            if (!advancedRef.current?.contains(event.target)) close();
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('pointerdown', handlePointerDown, true);
        };
    }, [isSettingsOpen]);

    useEffect(() => () => {
        generationRef.current += 1;
        if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
        if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
        clearRenderCache();
    }, []);

    // Release decoded bitmaps for images that left the list; the cache itself
    // is only cleared when the component unmounts.
    useEffect(() => {
        pruneRenderCache(images);
    }, [images]);

    useEffect(() => {
        if (images.length === 0) return undefined;

        let cancelled = false;
        const generation = ++generationRef.current;
        const isCurrentGeneration = () => !cancelled && generation === generationRef.current;

        setError('');
        setActionMessage('');
        setIsGenerating(true);

        const generateImage = async () => {
            const startedAt = performance.now();
            try {
                const loadedImages = await loadImagesForRender(images);
                if (!isCurrentGeneration()) return;
                const decodedAt = performance.now();

                setSourceImages(loadedImages);
                const canvas = canvasRef.current;
                if (!canvas) throw new Error('拼接画布未准备完成，请重试。');

                const currentFormat = getExportFormat(settings.export?.format);
                const previewPlan = createStitchPlan(loadedImages, settings);
                const preliminary = getExportDimensions(
                    previewPlan.totalWidth,
                    previewPlan.totalHeight,
                    settings.export || DEFAULT_EXPORT_SETTINGS
                );
                const maxPixels = preliminary.width * preliminary.height > SAFE_CANVAS_AREA
                    ? getSafeMaxPixels(preliminary.width * preliminary.height)
                    : DEFAULT_OUTPUT_LIMITS.maxPixels;
                const plan = renderStitch(canvas, loadedImages, settings, { maxPixels });
                applyRedactions(canvas, redactions);
                const blob = await canvasToBlob(
                    canvas,
                    currentFormat.mime,
                    currentFormat.lossy ? settings.export?.quality : undefined
                );
                if (!isCurrentGeneration()) return;

                if (import.meta.env.DEV) {
                    const encodedAt = performance.now();
                    window.__stitchDebug = {
                        ...(window.__stitchDebug || {}),
                        lastRender: {
                            decode: Math.round(decodedAt - startedAt),
                            encode: Math.round(encodedAt - decodedAt),
                            total: Math.round(encodedAt - startedAt),
                            width: plan.width,
                            height: plan.height,
                            format: currentFormat.id
                        }
                    };
                }

                const nextUrl = URL.createObjectURL(blob);
                const previousUrl = outputUrlRef.current;
                outputUrlRef.current = nextUrl;
                setCanvasUrl(nextUrl);
                if (previousUrl) URL.revokeObjectURL(previousUrl);
                setOutput({
                    width: plan.width,
                    height: plan.height,
                    scale: plan.scale,
                    bytes: blob.size,
                    format: plan.format,
                    sizeMode: plan.exportSettings?.sizeMode,
                    customEdge: plan.exportSettings?.customEdge,
                    binding: plan.binding,
                    maxPixels: plan.maxPixels,
                    flattened: plan.flattened
                });
            } catch (generationError) {
                if (isCurrentGeneration()) {
                    setError(generationError.message || '拼接失败，请检查图片后重试。');
                    setOutput(null);
                }
            } finally {
                if (isCurrentGeneration()) setIsGenerating(false);
            }
        };

        // Coalesce rapid slider/segmented changes into one render.
        const timer = window.setTimeout(generateImage, 160);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            if (generationRef.current === generation) generationRef.current += 1;
        };
    }, [images, settings, redactions, retryKey]);

    const estimate = useMemo(() => {
        if (!sourceImages || sourceImages.length === 0) return null;
        const plan = createStitchPlan(sourceImages, settings);
        const exportOptions = settings.export || DEFAULT_EXPORT_SETTINGS;
        const preliminary = getExportDimensions(plan.totalWidth, plan.totalHeight, exportOptions);
        const safeMaxPixels = preliminary.width * preliminary.height > SAFE_CANVAS_AREA
            ? getSafeMaxPixels(preliminary.width * preliminary.height)
            : DEFAULT_OUTPUT_LIMITS.maxPixels;
        const dimensions = getExportDimensions(
            plan.totalWidth,
            plan.totalHeight,
            exportOptions,
            { maxPixels: safeMaxPixels }
        );
        const longDimensions = getExportDimensions(
            plan.totalWidth,
            plan.totalHeight,
            { ...exportOptions, sizeMode: 'long' },
            { maxPixels: safeMaxPixels }
        );
        return {
            ...dimensions,
            megapixels: (dimensions.width * dimensions.height) / 1_000_000,
            deviceCapped: dimensions.maxPixels < DEFAULT_OUTPUT_LIMITS.maxPixels,
            longWidth: longDimensions.width,
            longHeight: longDimensions.height,
            longHelps: longDimensions.width > dimensions.width
        };
    }, [settings, sourceImages]);

    const updateSettings = useCallback((patch) => {
        onSettingsChange((previous) => ({ ...previous, ...patch }));
    }, [onSettingsChange]);

    const updateExport = useCallback((patch) => {
        onSettingsChange((previous) => ({
            ...previous,
            export: { ...DEFAULT_EXPORT_SETTINGS, ...previous.export, ...patch }
        }));
    }, [onSettingsChange]);

    const resetSettings = useCallback(() => {
        onResetSettings();
    }, [onResetSettings]);

    const triggerDownload = useCallback((blobOrUrl, filename) => {
        const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        link.remove();
        if (typeof blobOrUrl !== 'string') {
            window.setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
    }, []);

    const handleDownload = useCallback(async () => {
        if (!canvasUrl || !output || !canvasRef.current) return;

        try {
            const stamp = downloadStamp();
            const base = `stitch-${settings.direction}-${stamp}`;
            const ranges = getSliceRanges(output.height, sliceHeight);

            if (ranges.length > 1) {
                const slices = await sliceCanvasToBlobs(canvasRef.current, {
                    sliceHeight,
                    mime: output.format.mime,
                    quality: output.format.lossy ? exportSettings.quality : undefined
                });
                for (const slice of slices) {
                    triggerDownload(
                        slice.blob,
                        sliceFilename(base, slice.index, slices.length, output.format.ext)
                    );
                    await new Promise((resolve) => window.setTimeout(resolve, 150));
                }
                setActionMessage(`已导出 ${slices.length} 张切片`);
                return;
            }

            triggerDownload(canvasUrl, `${base}.${output.format.ext}`);
            setActionMessage('');
        } catch (downloadError) {
            setActionMessage(downloadError.message || '导出失败，请重试。');
        }
    }, [canvasUrl, exportSettings.quality, output, settings.direction, sliceHeight, triggerDownload]);

    const handleDownloadPdf = useCallback(async () => {
        if (!canvasRef.current || !output) return;

        try {
            const blob = await canvasToPdfBlob(canvasRef.current, { sliceHeight });
            triggerDownload(blob, `stitch-${settings.direction}-${downloadStamp()}.pdf`);
            setActionMessage('已导出 PDF');
        } catch (downloadError) {
            setActionMessage(downloadError.message || 'PDF 导出失败，请重试。');
        }
    }, [output, settings.direction, sliceHeight, triggerDownload]);

    const handleCopy = async () => {
        if (!canvasRef.current) return;

        try {
            if (!navigator.clipboard?.write || !window.ClipboardItem) {
                throw new Error('当前浏览器不支持复制图片，请改用下载。');
            }

            // The clipboard path always encodes PNG so pasting is predictable.
            const blob = await canvasToBlob(canvasRef.current, 'image/png');
            await navigator.clipboard.write([
                new window.ClipboardItem({ [blob.type]: blob })
            ]);
            setIsCopied(true);
            setActionMessage('');
            if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
            copyTimerRef.current = window.setTimeout(() => setIsCopied(false), 1500);
        } catch (copyError) {
            setActionMessage(copyError.message || '复制图片失败，请改用下载。');
        }
    };

    const addRedaction = useCallback((rectangle) => {
        setRedactions((previous) => [...previous, {
            ...rectangle,
            mode: redactionMode,
            color: redactionColor
        }]);
    }, [redactionColor, redactionMode]);

    const undoRedaction = useCallback(() => {
        setRedactions((previous) => previous.slice(0, -1));
    }, []);

    const clearRedactions = useCallback(() => {
        setRedactions([]);
    }, []);

    const toggleRedactMode = useCallback(() => {
        if (redactMode) {
            setRedactMode(false);
            setActionMessage('');
            return;
        }
        updateSettings({ previewMode: 'fit' });
        setRedactMode(true);
        setActionMessage('拖动结果图框选要打码的区域');
    }, [redactMode, updateSettings]);

    const showPreview = Boolean(canvasUrl) && !error;
    const hasResult = showPreview && !isGenerating;
    const outputFormat = output?.format || format;
    const sliceCount = output ? getSliceRanges(output.height, sliceHeight).length : 1;

    useEffect(() => {
        const handleKeyDown = (event) => {
            const saveShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';
            if (!saveShortcut || isEditableTarget(event.target)) return;
            event.preventDefault();
            if (hasResult) handleDownload();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasResult, handleDownload]);

    const deviceCapped = output?.maxPixels < DEFAULT_OUTPUT_LIMITS.maxPixels;
    const scaleNote = (() => {
        if (!output || output.scale >= 1) return '';
        const binding = output.binding;
        if (output.sizeMode === 'width1080') {
            return binding === 'width' ? '已缩放到 1080 宽' : '已按上限缩放';
        }
        if (output.sizeMode === 'edge4096') {
            return binding === 'edge' ? '已缩放到长边 4096' : '已按上限缩放';
        }
        if (output.sizeMode === 'custom') {
            return binding === 'edge' ? `已缩放到长边 ${output.customEdge ?? exportSettings.customEdge}` : '已按上限缩放';
        }
        if (binding === 'pixels' && deviceCapped) return '已按设备画布上限缩放';
        return '已按上限缩放';
    })();
    const sizeLabel = output
        ? [formatBytes(output.bytes), scaleNote].filter(Boolean).join(' · ')
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
                            onClick={() => updateSettings({ direction })}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {settings.direction === 'collage' && (
                    <label className="grid-preset">
                        <span className="visually-hidden">网格布局</span>
                        <select
                            aria-label="网格布局"
                            value={settings.gridPreset || 'auto'}
                            onChange={(event) => updateSettings({ gridPreset: event.target.value })}
                        >
                            {GRID_PRESETS.map(([id, label]) => (
                                <option key={id} value={id}>{label}</option>
                            ))}
                        </select>
                    </label>
                )}

                <label className="seam" title={gridDirect ? '网格预设使用直边拼缝' : undefined}>
                    <input
                        type="checkbox"
                        checked={showWave}
                        disabled={gridDirect}
                        onChange={(event) => updateSettings({ showWave: event.target.checked })}
                    />
                    <span className="seam-box" aria-hidden="true">
                        <svg viewBox="0 0 16 10" fill="none" focusable="false">
                            <path d="M1 5q2-4 4 0t4 0t4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                    </span>
                    <span className="seam-label">波浪接缝</span>
                </label>

                <div className="segmented preview-modes" role="group" aria-label="预览方式">
                    <button
                        type="button"
                        className={previewMode === 'fit' ? 'is-active' : ''}
                        aria-pressed={previewMode === 'fit'}
                        disabled={redactMode}
                        onClick={() => updateSettings({ previewMode: 'fit' })}
                    >
                        适应整图
                    </button>
                    <button
                        type="button"
                        className={previewMode === 'width' ? 'is-active' : ''}
                        aria-pressed={previewMode === 'width'}
                        disabled={redactMode}
                        onClick={() => updateSettings({ previewMode: 'width' })}
                    >
                        适应宽度
                    </button>
                </div>

                <details
                    className="advanced"
                    ref={advancedRef}
                    onToggle={(event) => setIsSettingsOpen(event.currentTarget.open)}
                >
                    <summary className="advanced-trigger">
                        设置
                        {isCustomized && <span className="advanced-dot" aria-hidden="true" />}
                        {isCustomized && <span className="visually-hidden">，有自定义设置</span>}
                        <ChevronIcon />
                    </summary>

                    <StitchSettings
                        settings={settings}
                        exportSettings={exportSettings}
                        format={format}
                        support={support}
                        qualityValue={qualityValue}
                        estimate={estimate}
                        sessionStatus={sessionStatus}
                        onSettingChange={updateSettings}
                        onExportChange={updateExport}
                        onResetSettings={resetSettings}
                        onClearSession={onClearSession}
                    />
                </details>
            </div>

            <div className="stage-stack">
                {redactMode && (
                    <div className="redaction-toolbar" role="group" aria-label="打码工具">
                        <span className="redaction-toolbar__hint">拖动结果图框选要打码的区域</span>
                        <div className="redaction-modes" role="group" aria-label="打码方式">
                            <button
                                type="button"
                                className={`btn btn--secondary btn--sm${redactionMode === 'mosaic' ? ' is-active' : ''}`}
                                aria-pressed={redactionMode === 'mosaic'}
                                onClick={() => setRedactionMode('mosaic')}
                            >
                                马赛克
                            </button>
                            <button
                                type="button"
                                className={`btn btn--secondary btn--sm${redactionMode === 'color' ? ' is-active' : ''}`}
                                aria-pressed={redactionMode === 'color'}
                                onClick={() => setRedactionMode('color')}
                            >
                                色块
                            </button>
                            {redactionMode === 'color' && (
                                <input
                                    type="color"
                                    aria-label="色块颜色"
                                    title="色块颜色"
                                    value={redactionColor}
                                    onChange={(event) => setRedactionColor(event.target.value)}
                                />
                            )}
                        </div>
                        <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={undoRedaction}
                            disabled={redactions.length === 0}
                        >
                            撤销上一处
                        </button>
                        <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={clearRedactions}
                            disabled={redactions.length === 0}
                        >
                            清除全部
                        </button>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={toggleRedactMode}>
                            完成
                        </button>
                    </div>
                )}
                <StitchStage
                    canvasRef={canvasRef}
                    isGenerating={isGenerating}
                    error={error}
                    canvasUrl={canvasUrl}
                    output={output}
                    previewMode={previewMode}
                    redactMode={redactMode}
                    onAddRedaction={addRedaction}
                    onRetry={() => setRetryKey((value) => value + 1)}
                />
            </div>

            <div className="stitch-actions">
                <p className="output-meta">
                    <span className="output-meta__label">输出</span>
                    {output ? (
                        <span className="output-meta__value mono">
                            {outputFormat.label} · {output.width} × {output.height} px
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
                        className={`btn btn--secondary${redactMode ? ' is-active' : ''}`}
                        onClick={toggleRedactMode}
                        disabled={!hasResult}
                        aria-pressed={redactMode}
                        title="框选区域并不可逆地打码"
                    >
                        打码{redactions.length > 0 ? `（${redactions.length}）` : ''}
                    </button>
                    <button
                        type="button"
                        className="btn btn--secondary"
                        onClick={handleCopy}
                        disabled={!hasResult}
                        title="复制当前预览为 PNG"
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
                        className="btn btn--secondary"
                        onClick={handleDownloadPdf}
                        disabled={!hasResult}
                        title={`导出 PDF${sliceCount > 1 ? `（${sliceCount} 页）` : ''}`}
                    >
                        下载 PDF
                    </button>
                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={handleDownload}
                        disabled={!hasResult}
                    >
                        <DownloadIcon />
                        {sliceCount > 1 ? `下载 ${sliceCount} 张切片` : `下载 ${outputFormat.label}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StitchCanvas;
