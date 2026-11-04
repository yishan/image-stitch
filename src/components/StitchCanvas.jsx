import { useEffect, useMemo, useRef, useState } from 'react';
import { SEAM_STRENGTHS, createStitchPlan } from '../lib/stitchLayout.js';
import {
    BACKGROUND_OPTIONS,
    DEFAULT_EXPORT_SETTINGS,
    DEFAULT_OUTPUT_LIMITS,
    EXPORT_FORMATS,
    SAFE_CANVAS_AREA,
    SIZE_MODE_OPTIONS,
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

const isCustomHex = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value || '');

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

const ChevronIcon = () => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const RangeField = ({ label, value, min, max, step, suffix = 'px', disabled = false, onChange }) => (
    <label className={`field${disabled ? ' is-disabled' : ''}`}>
        <span className="field__label">{label}</span>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(Number(event.target.value))}
        />
        <output className="field__value mono">{value}{suffix}</output>
    </label>
);

const ChoiceGroup = ({ label, options, value, disabled = false, onChange }) => (
    <div className="choice" role="group" aria-label={label}>
        <span className="choice__label">{label}</span>
        <div className="choice__options">
            {options.map(([id, text, optionDisabled]) => (
                <button
                    key={id}
                    type="button"
                    className={value === id ? 'is-active' : ''}
                    aria-pressed={value === id}
                    disabled={disabled || optionDisabled}
                    onClick={() => onChange(id)}
                >
                    {text}
                </button>
            ))}
        </div>
    </div>
);

const StitchCanvas = ({ images, settings, onSettingsChange }) => {
    const canvasRef = useRef(null);
    const generationRef = useRef(0);
    const outputUrlRef = useRef(null);
    const copyTimerRef = useRef(null);
    const advancedRef = useRef(null);
    const [sourceImages, setSourceImages] = useState(null);
    const [customEdgeDraft, setCustomEdgeDraft] = useState(() => String(settings.export?.customEdge ?? 4096));
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [canvasUrl, setCanvasUrl] = useState(null);
    const [output, setOutput] = useState(null);
    const [error, setError] = useState('');
    const [actionMessage, setActionMessage] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const exportSettings = settings.export || DEFAULT_EXPORT_SETTINGS;
    const format = getExportFormat(exportSettings.format);
    const support = getExportSupport();
    const showWave = settings.showWave !== false;
    const qualityValue = Math.round((exportSettings.quality ?? DEFAULT_EXPORT_SETTINGS.quality) * 100);
    const customColor = isCustomHex(settings.backgroundColor) ? settings.backgroundColor : '#ffffff';
    const isCustomized = (
        settings.gap > 0
        || settings.margin > 0
        || settings.radius > 0
        || settings.backgroundColor !== 'transparent'
        || settings.seamStrength !== 'regular'
        || exportSettings.format !== 'png'
        || exportSettings.sizeMode !== 'auto'
        || exportSettings.quality !== DEFAULT_EXPORT_SETTINGS.quality
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
    }, [images, settings, retryKey]);

    useEffect(() => {
        setCustomEdgeDraft(String(exportSettings.customEdge ?? 4096));
    }, [exportSettings.customEdge, exportSettings.sizeMode]);

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

    const updateSettings = (patch) => onSettingsChange((previous) => ({ ...previous, ...patch }));
    const updateExport = (patch) => onSettingsChange((previous) => ({
        ...previous,
        export: { ...DEFAULT_EXPORT_SETTINGS, ...previous.export, ...patch }
    }));

    const handleDownload = () => {
        if (!canvasUrl || !output) return;
        const link = document.createElement('a');
        link.download = `stitch-${settings.direction}-${downloadStamp()}.${output.format.ext}`;
        link.href = canvasUrl;
        link.click();
    };

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

    const showPreview = Boolean(canvasUrl) && !error;
    const hasResult = showPreview && !isGenerating;
    const outputFormat = output?.format || format;

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

                <label className="seam">
                    <input
                        type="checkbox"
                        checked={showWave}
                        onChange={(event) => updateSettings({ showWave: event.target.checked })}
                    />
                    <span className="seam-box" aria-hidden="true">
                        <svg viewBox="0 0 16 10" fill="none" focusable="false">
                            <path d="M1 5q2-4 4 0t4 0t4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                    </span>
                    <span className="seam-label">波浪接缝</span>
                </label>

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

                    <div className="advanced-panel">
                        <div className="advanced-group">
                            <h3>画布</h3>
                            <RangeField label="外边距" value={settings.margin || 0} min={0} max={64} step={4} onChange={(margin) => updateSettings({ margin })} />
                            <RangeField label="图片间距" value={settings.gap || 0} min={0} max={64} step={4} onChange={(gap) => updateSettings({ gap })} />
                            <RangeField
                                label="圆角"
                                value={settings.radius || 0}
                                min={0}
                                max={32}
                                step={2}
                                disabled={showWave}
                                onChange={(radius) => updateSettings({ radius })}
                            />
                            {showWave && <p className="field-hint">波浪接缝开启时，圆角暂不生效。</p>}

                            <div className="choice" role="group" aria-label="背景颜色">
                                <span className="choice__label">背景</span>
                                <div className="swatches">
                                    {BACKGROUND_OPTIONS.map(([id, label]) => (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`swatch swatch--${id}${settings.backgroundColor === id ? ' is-active' : ''}`}
                                            aria-pressed={settings.backgroundColor === id}
                                            onClick={() => updateSettings({ backgroundColor: id })}
                                            title={label}
                                        >
                                            <span className="visually-hidden">{label}</span>
                                        </button>
                                    ))}
                                    <label className={`swatch swatch--custom${isCustomHex(settings.backgroundColor) ? ' is-active' : ''}`} title="自定义背景色">
                                        <input
                                            type="color"
                                            value={customColor}
                                            onChange={(event) => updateSettings({ backgroundColor: event.target.value })}
                                        />
                                        <span className="visually-hidden">自定义背景色</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="advanced-group">
                            <h3>接缝</h3>
                            <ChoiceGroup
                                label="波浪强度"
                                options={SEAM_STRENGTHS}
                                value={settings.seamStrength || 'regular'}
                                disabled={!showWave}
                                onChange={(seamStrength) => updateSettings({ seamStrength })}
                            />
                            <p className="field-hint">作用于相邻图片之间的波浪线；关闭接缝后使用直边。</p>
                        </div>

                        <div className="advanced-group">
                            <h3>导出</h3>
                            <ChoiceGroup
                                label="格式"
                                options={EXPORT_FORMATS ? Object.values(EXPORT_FORMATS).map((item) => [item.id, item.label, !support[item.id]]) : []}
                                value={exportSettings.format}
                                onChange={(value) => updateExport({ format: value })}
                            />
                            {format.lossy ? (
                                <RangeField
                                    label="质量"
                                    value={qualityValue}
                                    min={30}
                                    max={100}
                                    step={5}
                                    suffix="%"
                                    onChange={(quality) => updateExport({ quality: quality / 100 })}
                                />
                            ) : (
                                <p className="field-hint">PNG 为无损格式，文件通常更大。</p>
                            )}

                            <label className="field field--select">
                                <span className="field__label">尺寸</span>
                                <select
                                    value={exportSettings.sizeMode}
                                    onChange={(event) => updateExport({ sizeMode: event.target.value })}
                                >
                                    {SIZE_MODE_OPTIONS.map(([id, label]) => (
                                        <option key={id} value={id}>{label}</option>
                                    ))}
                                </select>
                            </label>

                            {exportSettings.sizeMode === 'custom' && (
                                <label className="field field--number">
                                    <span className="field__label">最长边</span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="512"
                                        max="16384"
                                        step="64"
                                        value={customEdgeDraft}
                                        onChange={(event) => {
                                            const raw = event.target.value;
                                            setCustomEdgeDraft(raw);
                                            const next = Number(raw);
                                            if (raw !== '' && Number.isFinite(next) && next >= 512 && next <= 16384) {
                                                updateExport({ customEdge: Math.round(next) });
                                            }
                                        }}
                                        onBlur={() => {
                                            const next = Number(customEdgeDraft);
                                            const clamped = Number.isFinite(next) && customEdgeDraft !== ''
                                                ? Math.min(16384, Math.max(512, Math.round(next)))
                                                : exportSettings.customEdge;
                                            updateExport({ customEdge: clamped });
                                            setCustomEdgeDraft(String(clamped));
                                        }}
                                    />
                                    <span className="field__value mono">px</span>
                                </label>
                            )}

                            {estimate && (
                                <p className="estimate mono">
                                    预计 {estimate.width} × {estimate.height} px · {estimate.megapixels.toFixed(1)} MP
                                </p>
                            )}
                            {estimate && estimate.megapixels > 12 && (
                                <p className="field-hint field-hint--warn">大画布：导出可能需要几秒，移动端请留意内存。</p>
                            )}
                            {estimate && estimate.scaled && (
                                <p className="field-hint">当前尺寸会被安全上限等比缩小。</p>
                            )}
                            {estimate?.deviceCapped && (
                                <p className="field-hint field-hint--warn">当前浏览器的画布上限较低，大图会自动缩放到约 16 MP。</p>
                            )}
                            {estimate?.longHelps && exportSettings.sizeMode === 'auto' && (
                                <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => updateExport({ sizeMode: 'long' })}
                                >
                                    改用长图模式（保持 {estimate.longWidth} px 宽）
                                </button>
                            )}
                            {exportSettings.format === 'jpeg' && settings.backgroundColor === 'transparent' && (
                                <p className="field-hint">JPEG 不支持透明，将改用白色铺底。</p>
                            )}
                        </div>
                    </div>
                </details>
            </div>

            <div className="stage" aria-busy={isGenerating}>
                <canvas ref={canvasRef} className="hidden-canvas" />
                <div className="stage-ticks" aria-hidden="true">
                    <span /><span /><span /><span />
                </div>

                {isGenerating && !canvasUrl && (
                    <div className="stage-status">
                        <span className="stage-progress" aria-hidden="true"><span /></span>
                        <p>正在拼接…</p>
                    </div>
                )}

                {isGenerating && canvasUrl && (
                    <div className="stage-refreshing" role="status">
                        <span className="stage-progress" aria-hidden="true"><span /></span>
                        <span>更新中…</span>
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

                {showPreview && (
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
                        className="btn btn--primary"
                        onClick={handleDownload}
                        disabled={!hasResult}
                    >
                        <DownloadIcon />
                        下载 {outputFormat.label}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StitchCanvas;
