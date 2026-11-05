import { useState } from 'react';
import { SEAM_STRENGTHS } from '../lib/stitchLayout.js';
import {
    BACKGROUND_OPTIONS,
    EXPORT_FORMATS,
    SIZE_MODE_OPTIONS
} from '../lib/stitchRenderer.js';
import { isCustomHex } from '../lib/stitchSettings.js';
import { ChoiceGroup, RangeField } from './SettingsFields.jsx';
import { SLICE_HEIGHT_OPTIONS } from '../lib/exportSlices.js';

const SESSION_LABELS = {
    loading: '正在读取本机会话…',
    saving: '保存中…',
    saved: '已保存到本机',
    idle: '尚未保存',
    cleared: '已清除本机会话',
    error: '无法保存本机会话（浏览器限制）',
    unavailable: '当前浏览器不支持本机会话'
};

const CustomEdgeField = ({ value, onCommit }) => {
    const [draft, setDraft] = useState(String(value ?? 4096));

    return (
        <label className="field field--number">
            <span className="field__label">最长边</span>
            <input
                type="number"
                aria-label="自定义长边"
                inputMode="numeric"
                min="512"
                max="16384"
                step="64"
                value={draft}
                onChange={(event) => {
                    const raw = event.target.value;
                    setDraft(raw);
                    const next = Number(raw);
                    if (raw !== '' && Number.isFinite(next) && next >= 512 && next <= 16384) {
                        onCommit(Math.round(next));
                    }
                }}
                onBlur={() => {
                    const next = Number(draft);
                    const clamped = Number.isFinite(next) && draft !== ''
                        ? Math.min(16384, Math.max(512, Math.round(next)))
                        : value;
                    onCommit(clamped);
                    setDraft(String(clamped));
                }}
            />
            <span className="field__value mono">px</span>
        </label>
    );
};

const StitchSettings = ({
    settings,
    exportSettings,
    format,
    support,
    qualityValue,
    estimate,
    sessionStatus,
    onSettingChange,
    onExportChange,
    onResetSettings,
    onClearSession
}) => {
    const showWave = settings.showWave !== false;
    const gridDirect = settings.direction === 'collage' && (settings.gridPreset || 'auto') !== 'auto';
    const waveActive = showWave && !gridDirect;
    const customColor = isCustomHex(settings.backgroundColor) ? settings.backgroundColor : '#ffffff';

    return (
        <div className="advanced-panel">
            <div className="advanced-group">
                <h3>画布</h3>
                <RangeField label="外边距" value={settings.margin || 0} min={0} max={64} step={4} onChange={(margin) => onSettingChange({ margin })} />
                <RangeField label="图片间距" value={settings.gap || 0} min={0} max={64} step={4} onChange={(gap) => onSettingChange({ gap })} />
                <RangeField
                    label="圆角"
                    value={settings.radius || 0}
                    min={0}
                    max={32}
                    step={2}
                    disabled={waveActive}
                    onChange={(radius) => onSettingChange({ radius })}
                />
                {waveActive && <p className="field-hint">波浪接缝开启时，圆角暂不生效。</p>}
                {gridDirect && <p className="field-hint">网格预设使用直边拼缝，波浪接缝暂不生效。</p>}

                <div className="choice" role="group" aria-label="背景颜色">
                    <span className="choice__label">背景</span>
                    <div className="swatches">
                        {BACKGROUND_OPTIONS.map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                className={`swatch swatch--${id}${settings.backgroundColor === id ? ' is-active' : ''}`}
                                aria-pressed={settings.backgroundColor === id}
                                onClick={() => onSettingChange({ backgroundColor: id })}
                                title={label}
                            >
                                <span className="visually-hidden">{label}</span>
                            </button>
                        ))}
                        <label className={`swatch swatch--custom${isCustomHex(settings.backgroundColor) ? ' is-active' : ''}`} title="自定义背景色">
                            <input
                                type="color"
                                aria-label="自定义背景色"
                                value={customColor}
                                onChange={(event) => onSettingChange({ backgroundColor: event.target.value })}
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
                    disabled={!waveActive}
                    onChange={(seamStrength) => onSettingChange({ seamStrength })}
                />
                <p className="field-hint">作用于相邻图片之间的波浪线；关闭接缝后使用直边。</p>
            </div>

            <div className="advanced-group">
                <h3>导出</h3>
                <ChoiceGroup
                    label="格式"
                    options={Object.values(EXPORT_FORMATS).map((item) => [item.id, item.label, !support[item.id]])}
                    value={exportSettings.format}
                    onChange={(value) => onExportChange({ format: value })}
                />
                {format.lossy ? (
                    <RangeField
                        label="质量"
                        value={qualityValue}
                        min={30}
                        max={100}
                        step={5}
                        suffix="%"
                        onChange={(quality) => onExportChange({ quality: quality / 100 })}
                    />
                ) : (
                    <p className="field-hint">PNG 为无损格式，文件通常更大。</p>
                )}

                <label className="field field--select">
                    <span className="field__label">尺寸</span>
                    <select
                        aria-label="尺寸"
                        value={exportSettings.sizeMode}
                        onChange={(event) => onExportChange({ sizeMode: event.target.value })}
                    >
                        {SIZE_MODE_OPTIONS.map(([id, label]) => (
                            <option key={id} value={id}>{label}</option>
                        ))}
                    </select>
                </label>

                {exportSettings.sizeMode === 'custom' && (
                    <CustomEdgeField
                        value={exportSettings.customEdge}
                        onCommit={(customEdge) => onExportChange({ customEdge })}
                    />
                )}

                <label className="field field--select">
                    <span className="field__label">切片</span>
                    <select
                        aria-label="切片高度"
                        value={exportSettings.sliceHeight || 0}
                        onChange={(event) => onExportChange({ sliceHeight: Number(event.target.value) })}
                    >
                        {SLICE_HEIGHT_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </label>
                {estimate && Number(exportSettings.sliceHeight) > 0 && (
                    <p className="field-hint">
                        按高度切成 {Math.ceil(estimate.height / Number(exportSettings.sliceHeight))} 张切片，文件名带序号。
                    </p>
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
                        onClick={() => onExportChange({ sizeMode: 'long' })}
                    >
                        改用长图模式（保持 {estimate.longWidth} px 宽）
                    </button>
                )}
                {exportSettings.format === 'jpeg' && settings.backgroundColor === 'transparent' && (
                    <p className="field-hint">JPEG 不支持透明，将改用白色铺底。</p>
                )}
            </div>

            <div className="advanced-footer">
                <div className="advanced-footer__session">
                    <p className="field-hint">会话自动保存在本机浏览器（IndexedDB），不会上传。</p>
                    <p className="session-status" data-testid="session-status">
                        {SESSION_LABELS[sessionStatus] || SESSION_LABELS.idle}
                    </p>
                </div>
                <div className="advanced-footer__actions">
                    <p className="field-hint">快捷键：⌘/Ctrl+Z 撤销 · ⇧⌘/Ctrl+Z 重做 · ⌘/Ctrl+S 下载 · Delete 删除选中图片</p>
                    <button type="button" className="link-button" onClick={onResetSettings}>
                        恢复默认设置
                    </button>
                    <button type="button" className="link-button link-button--danger" onClick={onClearSession}>
                        清除本机会话
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StitchSettings;
