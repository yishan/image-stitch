import { useCallback, useState } from 'react';
import { normalizeTransform } from '../lib/imageTransform.js';
import { useI18n } from '../i18n/index.jsx';
import ImageAdjustments from './ImageAdjustments.jsx';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './ImagePreview.css';

const GripIcon = () => (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false">
        <circle cx="6" cy="4" r="1.1" />
        <circle cx="10" cy="4" r="1.1" />
        <circle cx="6" cy="8" r="1.1" />
        <circle cx="10" cy="8" r="1.1" />
        <circle cx="6" cy="12" r="1.1" />
        <circle cx="10" cy="12" r="1.1" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const SortableItem = ({ image, index, dimensions, selected, onSelect, onDimensions, onRemoveImage }) => {
    const { t } = useI18n();
    const {
        attributes,
        listeners,
        setNodeRef,
        setActivatorNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: image.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 2 : 'auto',
    };
    const imageName = image.file?.name || t('preview.imageFallback', { index: index + 1 });
    const imageTransform = normalizeTransform(image.transform);
    const previewStyle = {
        transform: `rotate(${imageTransform.rotate}deg) scaleX(${imageTransform.flipX ? -1 : 1}) scaleY(${imageTransform.flipY ? -1 : 1})`
    };

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`thumb${isDragging ? ' is-dragging' : ''}${selected ? ' is-selected' : ''}`}
            data-selected={selected || undefined}
            tabIndex={0}
            aria-current={selected ? 'true' : undefined}
            aria-label={`${t('preview.itemAria', { index: index + 1 })}${selected ? t('preview.selectedSuffix') : ''}`}
            onFocus={() => onSelect(image.id)}
            onClick={() => onSelect(image.id)}
        >
            <div className="thumb-frame">
                <img
                    src={image.url}
                    alt={t('preview.imageAlt', { index: index + 1, name: imageName })}
                    style={previewStyle}
                    onLoad={(event) => onDimensions(image.id, {
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight
                    })}
                />
                <span className="thumb-index mono" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                </span>
                <button
                    type="button"
                    className="thumb-remove"
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemoveImage(image.id);
                    }}
                    aria-label={t('preview.removeAria', { index: index + 1, name: imageName })}
                    title={t('preview.removeTitle')}
                >
                    <CloseIcon />
                </button>
            </div>
            <div className="thumb-meta">
                <span
                    className="thumb-dim mono"
                    aria-hidden="true"
                    title={dimensions ? `${dimensions.width}×${dimensions.height} · ${t('preview.ratio', { ratio: (dimensions.width / dimensions.height).toFixed(2) })}` : undefined}
                >
                    {dimensions ? `${dimensions.width}×${dimensions.height}` : '—'}
                </span>
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="thumb-grip"
                    aria-label={t('preview.dragAria', { index: index + 1 })}
                    title={t('preview.dragTitle')}
                    {...attributes}
                    {...listeners}
                >
                    <GripIcon />
                </button>
            </div>
        </li>
    );
};

const ImagePreview = ({ images, max = 6, direction = 'vertical', gridPreset = 'auto', selectedId = null, onSelectImage, onUpdateTransform, onRemoveImage, onDragEnd, onReset }) => {
    const { t } = useI18n();
    const [dimensions, setDimensions] = useState({});
    const handleDimensions = useCallback((id, size) => {
        setDimensions((previous) => {
            const current = previous[id];
            if (current && current.width === size.width && current.height === size.height) return previous;
            return { ...previous, [id]: size };
        });
    }, []);

    const crossAxis = direction === 'vertical' ? 'width' : 'height';
    const crossSizes = images.map((image) => dimensions[image.id]?.[crossAxis]).filter(Boolean);
    const maxCrossSize = crossSizes.length > 0 ? Math.max(...crossSizes) : 0;
    const smallerCount = maxCrossSize > 0
        ? images.filter((image) => dimensions[image.id] && dimensions[image.id][crossAxis] < maxCrossSize).length
        : 0;

    const selectedIndex = images.findIndex((image) => image.id === selectedId);
    const selectedImage = selectedIndex >= 0 ? images[selectedIndex] : null;

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const positionFor = (id) => images.findIndex((image) => image.id === id) + 1;
    const announcements = {
        onDragStart: ({ active }) => t('preview.dragStart', { index: positionFor(active.id) }),
        onDragOver: ({ active, over }) => over
            ? t('preview.dragOver', { index: positionFor(active.id), over: positionFor(over.id) })
            : t('preview.dragOut'),
        onDragEnd: ({ active, over }) => over
            ? t('preview.dragEnd', { index: positionFor(active.id), over: positionFor(over.id) })
            : t('preview.dragCancel'),
        onDragCancel: () => t('preview.dragCancel')
    };

    if (images.length === 0) return null;

    const handleReset = () => {
        if (window.confirm(t('preview.clearConfirm'))) onReset();
    };

    return (
        <section className="preview" aria-labelledby="selected-images-title">
            <div className="preview-head">
                <h2 id="selected-images-title">{t('preview.title')}</h2>
                <span className="preview-count mono" aria-hidden="true">
                    {images.length} / {max}
                </span>
                <span className="visually-hidden">{t('preview.countAria', { count: images.length, max })}</span>
                <button type="button" className="preview-reset" onClick={handleReset} title={t('preview.clearTitle')}>
                    {t('preview.clear')}
                </button>
            </div>
            <p className="preview-hint">{t('preview.hint')}</p>
            {smallerCount > 0 && (
                <p className="preview-note">
                    {t('preview.small', { count: smallerCount })}
                </p>
            )}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                accessibility={{
                    announcements,
                    screenReaderInstructions: { draggable: t('preview.instructions') }
                }}
            >
                <SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}>
                    <ul className="preview-grid">
                        {images.map((image, index) => (
                            <SortableItem
                                key={image.id}
                                image={image}
                                index={index}
                                dimensions={dimensions[image.id]}
                                selected={selectedId === image.id}
                                onSelect={onSelectImage}
                                onDimensions={handleDimensions}
                                onRemoveImage={onRemoveImage}
                            />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>

            {selectedImage ? (
                <ImageAdjustments
                    key={selectedImage.id}
                    image={selectedImage}
                    index={selectedIndex}
                    count={images.length}
                    direction={direction}
                    gridPreset={gridPreset}
                    onUpdateTransform={onUpdateTransform}
                />
            ) : (
                <div className="adjustments adjustments--hint">
                    <span className="mono">{t('preview.adjustHintLabel')}</span>
                    <span>{t('preview.adjustHint')}</span>
                </div>
            )}
        </section>
    );
};

export default ImagePreview;
