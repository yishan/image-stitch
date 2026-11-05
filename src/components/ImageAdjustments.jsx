import { DEFAULT_TRANSFORM, FOCUS_POSITIONS, normalizeTransform } from '../lib/imageTransform.js';
import { getGridCellAspect } from '../lib/stitchLayout.js';
import { useI18n } from '../i18n/index.jsx';
import FocusEditor from './FocusEditor.jsx';

const POSITION_KEYS = {
    左上: 'topLeft',
    上: 'top',
    右上: 'topRight',
    左: 'left',
    居中: 'center',
    右: 'right',
    左下: 'bottomLeft',
    下: 'bottom',
    右下: 'bottomRight'
};

const ImageAdjustments = ({ image, index, count, direction, gridPreset, onUpdateTransform }) => {
    const { t } = useI18n();
    if (!image) return null;

    const transform = normalizeTransform(image.transform);
    const focusEnabled = direction === 'collage' && gridPreset !== 'auto';
    const focusPreset = FOCUS_POSITIONS.find(([, x, y]) => (
        Math.abs(x - transform.focusX) < 0.01 && Math.abs(y - transform.focusY) < 0.01
    ));
    const focusValue = focusPreset?.[0] || 'custom';
    const cellAspect = getGridCellAspect(gridPreset, index, count);

    return (
        <div className="adjustments" role="group" aria-label={t('adjust.groupAria', { index: index + 1 })}>
            <div className="adjustments__head">
                <span className="mono">{String(index + 1).padStart(2, '0')}</span>
                <span>{t('adjust.title')}</span>
            </div>

            <div className="adjustments__row">
                <button
                    type="button"
                    className="chip"
                    onClick={() => onUpdateTransform(image.id, { rotate: (transform.rotate + 90) % 360 })}
                    title={t('adjust.rotateTitle')}
                >
                    {t('adjust.rotate')}
                </button>
                <button
                    type="button"
                    className={`chip${transform.flipX ? ' is-active' : ''}`}
                    aria-pressed={transform.flipX}
                    onClick={() => onUpdateTransform(image.id, { flipX: !transform.flipX })}
                >
                    {t('adjust.flipX')}
                </button>
                <button
                    type="button"
                    className={`chip${transform.flipY ? ' is-active' : ''}`}
                    aria-pressed={transform.flipY}
                    onClick={() => onUpdateTransform(image.id, { flipY: !transform.flipY })}
                >
                    {t('adjust.flipY')}
                </button>
            </div>

            <div className="adjustments__row">
                <span className="adjustments__label">{t('adjust.fill')}</span>
                <div className="segmented adjustments__segmented" role="group" aria-label={t('adjust.fitAria')}>
                    <button
                        type="button"
                        className={transform.fit === 'contain' ? 'is-active' : ''}
                        aria-pressed={transform.fit === 'contain'}
                        onClick={() => onUpdateTransform(image.id, { fit: 'contain' })}
                    >
                        {t('adjust.contain')}
                    </button>
                    <button
                        type="button"
                        className={transform.fit === 'cover' ? 'is-active' : ''}
                        aria-pressed={transform.fit === 'cover'}
                        onClick={() => onUpdateTransform(image.id, { fit: 'cover' })}
                    >
                        {t('adjust.cover')}
                    </button>
                </div>
                <button
                    type="button"
                    className="chip adjustments__reset"
                    onClick={() => onUpdateTransform(image.id, DEFAULT_TRANSFORM)}
                    title={t('adjust.resetTitle')}
                >
                    {t('adjust.reset')}
                </button>
            </div>

            {transform.fit === 'cover' && focusEnabled && (
                <div className="adjustments__focus-block">
                    <FocusEditor
                        image={image}
                        index={index}
                        cellAspect={cellAspect}
                        onChange={onUpdateTransform}
                    />
                    <label className="adjustments__focus">
                        <span className="adjustments__label">{t('adjust.preset')}</span>
                        <select
                            aria-label={t('adjust.focusAria')}
                            value={focusValue}
                            onChange={(event) => {
                                const position = FOCUS_POSITIONS.find(([name]) => name === event.target.value);
                                if (position) onUpdateTransform(image.id, { focusX: position[1], focusY: position[2] });
                            }}
                        >
                            {!focusPreset && <option value="custom" disabled>{t('adjust.custom')}</option>}
                            {FOCUS_POSITIONS.map(([name]) => (
                                <option key={name} value={name}>{t(`focus.positions.${POSITION_KEYS[name]}`)}</option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            {transform.fit === 'cover' && !focusEnabled && (
                <p className="field-hint">
                    {direction === 'collage'
                        ? t('adjust.hintAuto')
                        : t('adjust.hintFixed')}
                </p>
            )}
        </div>
    );
};

export default ImageAdjustments;
