import { DEFAULT_TRANSFORM, FOCUS_POSITIONS, normalizeTransform } from '../lib/imageTransform.js';
import { getGridCellAspect } from '../lib/stitchLayout.js';
import FocusEditor from './FocusEditor.jsx';

const ImageAdjustments = ({ image, index, count, direction, gridPreset, onUpdateTransform }) => {
    if (!image) return null;

    const transform = normalizeTransform(image.transform);
    const focusEnabled = direction === 'collage' && gridPreset !== 'auto';
    const focusPreset = FOCUS_POSITIONS.find(([, x, y]) => (
        Math.abs(x - transform.focusX) < 0.01 && Math.abs(y - transform.focusY) < 0.01
    ));
    const focusValue = focusPreset?.[0] || 'custom';
    const cellAspect = getGridCellAspect(gridPreset, index, count);

    return (
        <div className="adjustments" role="group" aria-label={`调整第 ${index + 1} 张图片`}>
            <div className="adjustments__head">
                <span className="mono">{String(index + 1).padStart(2, '0')}</span>
                <span>调整选中图片</span>
            </div>

            <div className="adjustments__row">
                <button
                    type="button"
                    className="chip"
                    onClick={() => onUpdateTransform(image.id, { rotate: (transform.rotate + 90) % 360 })}
                    title="顺时针旋转 90°"
                >
                    旋转 90°
                </button>
                <button
                    type="button"
                    className={`chip${transform.flipX ? ' is-active' : ''}`}
                    aria-pressed={transform.flipX}
                    onClick={() => onUpdateTransform(image.id, { flipX: !transform.flipX })}
                >
                    水平翻转
                </button>
                <button
                    type="button"
                    className={`chip${transform.flipY ? ' is-active' : ''}`}
                    aria-pressed={transform.flipY}
                    onClick={() => onUpdateTransform(image.id, { flipY: !transform.flipY })}
                >
                    垂直翻转
                </button>
            </div>

            <div className="adjustments__row">
                <span className="adjustments__label">填充</span>
                <div className="segmented adjustments__segmented" role="group" aria-label="填充方式">
                    <button
                        type="button"
                        className={transform.fit === 'contain' ? 'is-active' : ''}
                        aria-pressed={transform.fit === 'contain'}
                        onClick={() => onUpdateTransform(image.id, { fit: 'contain' })}
                    >
                        适配
                    </button>
                    <button
                        type="button"
                        className={transform.fit === 'cover' ? 'is-active' : ''}
                        aria-pressed={transform.fit === 'cover'}
                        onClick={() => onUpdateTransform(image.id, { fit: 'cover' })}
                    >
                        填满
                    </button>
                </div>
                <button
                    type="button"
                    className="chip adjustments__reset"
                    onClick={() => onUpdateTransform(image.id, DEFAULT_TRANSFORM)}
                    title="重置这张图片的旋转、翻转与填充"
                >
                    重置
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
                        <span className="adjustments__label">预设</span>
                        <select
                            aria-label="焦点位置"
                            value={focusValue}
                            onChange={(event) => {
                                const position = FOCUS_POSITIONS.find(([name]) => name === event.target.value);
                                if (position) onUpdateTransform(image.id, { focusX: position[1], focusY: position[2] });
                            }}
                        >
                            {!focusPreset && <option value="custom" disabled>自定义</option>}
                            {FOCUS_POSITIONS.map(([name]) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </label>
                </div>
            )}

            {transform.fit === 'cover' && !focusEnabled && (
                <p className="field-hint">
                    {direction === 'collage'
                        ? '自动网格保持图片原始尺寸；填充/焦点在 2×2、1+2、1+3 预设中生效。'
                        : '纵向/横向会按交叉轴填满；焦点在固定网格预设中生效。'}
                </p>
            )}
        </div>
    );
};

export default ImageAdjustments;
