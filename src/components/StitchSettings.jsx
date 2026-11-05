import { useState } from 'react';
import { SEAM_STRENGTHS } from '../lib/stitchLayout.js';
import {
    BACKGROUND_OPTIONS,
    EXPORT_FORMATS,
    SIZE_MODE_OPTIONS
} from '../lib/stitchRenderer.js';
import { isCustomHex } from '../lib/stitchSettings.js';
import { ChoiceGroup, RangeField } from './SettingsFields.jsx';
import { useI18n } from '../i18n/index.jsx';
import { SLICE_HEIGHT_OPTIONS } from '../lib/exportSlices.js';


const CustomEdgeField = ({ value, onCommit }) => {
    const { t } = useI18n();
    const [draft, setDraft] = useState(String(value ?? 4096));

    return (
        <label className="field field--number">
            <span className="field__label">{t('settings.customEdge')}</span>
            <input
                type="number"
                aria-label={t('settings.customEdgeAria')}
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
    const { t } = useI18n();
    const showWave = settings.showWave !== false;
    const gridDirect = settings.direction === 'collage' && (settings.gridPreset || 'auto') !== 'auto';
    const waveActive = showWave && !gridDirect;
    const customColor = isCustomHex(settings.backgroundColor) ? settings.backgroundColor : '#ffffff';

    return (
        <div className="advanced-panel">
            <div className="advanced-group">
                <h3>{t('settings.canvas')}</h3>
                <RangeField label={t('settings.margin')} value={settings.margin || 0} min={0} max={64} step={4} onChange={(margin) => onSettingChange({ margin })} />
                <RangeField label={t('settings.gap')} value={settings.gap || 0} min={0} max={64} step={4} onChange={(gap) => onSettingChange({ gap })} />
                <RangeField
                    label={t('settings.radius')}
                    value={settings.radius || 0}
                    min={0}
                    max={32}
                    step={2}
                    disabled={waveActive}
                    onChange={(radius) => onSettingChange({ radius })}
                />
                {waveActive && <p className="field-hint">{t('settings.radiusWaveHint')}</p>}
                {gridDirect && <p className="field-hint">{t('settings.gridDirectHint')}</p>}

                <div className="choice" role="group" aria-label={t('settings.backgroundAria')}>
                    <span className="choice__label">{t('settings.background')}</span>
                    <div className="swatches">
                        {BACKGROUND_OPTIONS.map(([id]) => (
                            <button
                                key={id}
                                type="button"
                                className={`swatch swatch--${id}${settings.backgroundColor === id ? ' is-active' : ''}`}
                                aria-pressed={settings.backgroundColor === id}
                                onClick={() => onSettingChange({ backgroundColor: id })}
                                title={t(`settings.backgroundOptions.${id}`)}
                            >
                                <span className="visually-hidden">{t(`settings.backgroundOptions.${id}`)}</span>
                            </button>
                        ))}
                        <label className={`swatch swatch--custom${isCustomHex(settings.backgroundColor) ? ' is-active' : ''}`} title={t('settings.customBg')}>
                            <input
                                type="color"
                                aria-label={t('settings.customBg')}
                                value={customColor}
                                onChange={(event) => onSettingChange({ backgroundColor: event.target.value })}
                            />
                            <span className="visually-hidden">{t('settings.customBg')}</span>
                        </label>
                    </div>
                </div>
            </div>

            <div className="advanced-group">
                <h3>{t('settings.seam')}</h3>
                <ChoiceGroup
                    label={t('settings.seamStrength')}
                    options={SEAM_STRENGTHS.map(([id]) => [id, t(`settings.seamStrengths.${id}`)])}
                    value={settings.seamStrength || 'regular'}
                    disabled={!waveActive}
                    onChange={(seamStrength) => onSettingChange({ seamStrength })}
                />
                <p className="field-hint">{t('settings.seamHint')}</p>
            </div>

            <div className="advanced-group">
                <h3>{t('settings.export')}</h3>
                <ChoiceGroup
                    label={t('settings.format')}
                    options={Object.values(EXPORT_FORMATS).map((item) => [item.id, item.label, !support[item.id]])}
                    value={exportSettings.format}
                    onChange={(value) => onExportChange({ format: value })}
                />
                {format.lossy ? (
                    <RangeField
                        label={t('settings.quality')}
                        value={qualityValue}
                        min={30}
                        max={100}
                        step={5}
                        suffix="%"
                        onChange={(quality) => onExportChange({ quality: quality / 100 })}
                    />
                ) : (
                    <p className="field-hint">{t('settings.pngHint')}</p>
                )}

                <label className="field field--select">
                    <span className="field__label">{t('settings.size')}</span>
                    <select
                        aria-label={t('settings.sizeAria')}
                        value={exportSettings.sizeMode}
                        onChange={(event) => onExportChange({ sizeMode: event.target.value })}
                    >
                        {SIZE_MODE_OPTIONS.map(([id]) => (
                            <option key={id} value={id}>{t(`settings.sizeModes.${id}`)}</option>
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
                    <span className="field__label">{t('settings.slice')}</span>
                    <select
                        aria-label={t('settings.sliceAria')}
                        value={exportSettings.sliceHeight || 0}
                        onChange={(event) => onExportChange({ sliceHeight: Number(event.target.value) })}
                    >
                        {SLICE_HEIGHT_OPTIONS.map(([value]) => (
                            <option key={value} value={value}>{t(value === 0 ? 'settings.sliceOptions.none' : `settings.sliceOptions.h${value}`)}</option>
                        ))}
                    </select>
                </label>
                {estimate && Number(exportSettings.sliceHeight) > 0 && (
                    <p className="field-hint">
                        {t('settings.sliceHint', { count: Math.ceil(estimate.height / Number(exportSettings.sliceHeight)) })}
                    </p>
                )}

                {estimate && (
                    <p className="estimate mono">
                        {t('settings.estimate', { width: estimate.width, height: estimate.height, mp: estimate.megapixels.toFixed(1) })}
                    </p>
                )}
                {estimate && estimate.megapixels > 12 && (
                    <p className="field-hint field-hint--warn">{t('settings.largeCanvasHint')}</p>
                )}
                {estimate && estimate.scaled && (
                    <p className="field-hint">{t('settings.scaledHint')}</p>
                )}
                {estimate?.deviceCapped && (
                    <p className="field-hint field-hint--warn">{t('settings.deviceCapHint')}</p>
                )}
                {estimate?.longHelps && exportSettings.sizeMode === 'auto' && (
                    <button
                        type="button"
                        className="link-button"
                        onClick={() => onExportChange({ sizeMode: 'long' })}
                    >
                        {t('settings.longMode', { width: estimate.longWidth })}
                    </button>
                )}
                {exportSettings.format === 'jpeg' && settings.backgroundColor === 'transparent' && (
                    <p className="field-hint">{t('settings.jpegTransparentHint')}</p>
                )}
            </div>

            <div className="advanced-footer">
                <div className="advanced-footer__session">
                    <p className="field-hint">{t('settings.sessionHint')}</p>
                    <p className="session-status" data-testid="session-status">
                        {t(`settings.sessions.${sessionStatus || 'idle'}`)}
                    </p>
                </div>
                <div className="advanced-footer__actions">
                    <p className="field-hint">{t('settings.shortcuts')}</p>
                    <button type="button" className="link-button" onClick={onResetSettings}>
                        {t('settings.restoreDefaults')}
                    </button>
                    <button type="button" className="link-button link-button--danger" onClick={onClearSession}>
                        {t('settings.clearSession')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StitchSettings;
