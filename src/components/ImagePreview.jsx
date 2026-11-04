import { useCallback, useState } from 'react';
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
    const imageName = image.file?.name || `图片 ${index + 1}`;

    return (
        <li
            ref={setNodeRef}
            style={style}
            className={`thumb${isDragging ? ' is-dragging' : ''}${selected ? ' is-selected' : ''}`}
            data-selected={selected || undefined}
            tabIndex={0}
            aria-current={selected ? 'true' : undefined}
            aria-label={`第 ${index + 1} 张图片${selected ? '（已选中，按 Delete 删除）' : ''}`}
            onFocus={() => onSelect(image.id)}
            onClick={() => onSelect(image.id)}
        >
            <div className="thumb-frame">
                <img
                    src={image.url}
                    alt={`第 ${index + 1} 张图片：${imageName}`}
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
                    aria-label={`移除第 ${index + 1} 张图片：${imageName}`}
                    title="移除图片"
                >
                    <CloseIcon />
                </button>
            </div>
            <div className="thumb-meta">
                <span
                    className="thumb-dim mono"
                    aria-hidden="true"
                    title={dimensions ? `${dimensions.width}×${dimensions.height} · 比例 ${(dimensions.width / dimensions.height).toFixed(2)}:1` : undefined}
                >
                    {dimensions ? `${dimensions.width}×${dimensions.height}` : '—'}
                </span>
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="thumb-grip"
                    aria-label={`拖动调整第 ${index + 1} 张图片顺序`}
                    title="拖动排序"
                    {...attributes}
                    {...listeners}
                >
                    <GripIcon />
                </button>
            </div>
        </li>
    );
};

const ImagePreview = ({ images, max = 6, direction = 'vertical', selectedId = null, onSelectImage, onRemoveImage, onDragEnd, onReset }) => {
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

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );
    const positionFor = (id) => images.findIndex((image) => image.id === id) + 1;
    const announcements = {
        onDragStart: ({ active }) => `已开始调整第 ${positionFor(active.id)} 张图片。`,
        onDragOver: ({ active, over }) => over
            ? `第 ${positionFor(active.id)} 张图片位于第 ${positionFor(over.id)} 张图片附近。`
            : '图片已移出排序区域。',
        onDragEnd: ({ active, over }) => over
            ? `第 ${positionFor(active.id)} 张图片已移动到第 ${positionFor(over.id)} 张图片位置。`
            : '排序已取消。',
        onDragCancel: () => '排序已取消。'
    };

    if (images.length === 0) return null;

    const handleReset = () => {
        if (window.confirm('确定清空所有已选图片吗？此操作无法撤销。')) onReset();
    };

    return (
        <section className="preview" aria-labelledby="selected-images-title">
            <div className="preview-head">
                <h2 id="selected-images-title">已选图片</h2>
                <span className="preview-count mono" aria-hidden="true">
                    {images.length} / {max}
                </span>
                <span className="visually-hidden">已选 {images.length} 张，最多 {max} 张</span>
                <button type="button" className="preview-reset" onClick={handleReset} title="清空所有图片">
                    清空
                </button>
            </div>
            <p className="preview-hint">拖动右下角手柄调整顺序</p>
            {smallerCount > 0 && (
                <p className="preview-note">
                    {smallerCount} 张图片分辨率偏小，将保持原始尺寸居中（不放大）
                </p>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                accessibility={{
                    announcements,
                    screenReaderInstructions: { draggable: '按空格键开始排序，使用方向键移动，再按空格键放下。' }
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
        </section>
    );
};

export default ImagePreview;
