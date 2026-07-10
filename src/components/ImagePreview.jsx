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

const SortableItem = ({ image, index, onRemoveImage }) => {
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
        zIndex: isDragging ? 1 : 0,
        opacity: isDragging ? 0.5 : 1,
    };
    const imageName = image.file?.name || `图片 ${index + 1}`;

    return (
        <div ref={setNodeRef} style={style} className="preview-item">
            <div className="image-wrapper">
                <img src={image.url} alt={`第 ${index + 1} 张：${imageName}`} />
                <button
                    type="button"
                    className="remove-btn"
                    onClick={() => onRemoveImage(image.id)}
                    aria-label={`移除第 ${index + 1} 张图片：${imageName}`}
                    title="移除图片"
                >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="preview-item-footer">
                <span className="image-index">{index + 1}</span>
                <button
                    type="button"
                    ref={setActivatorNodeRef}
                    className="drag-handle"
                    aria-label={`调整第 ${index + 1} 张图片顺序`}
                    title="拖拽排序"
                    {...attributes}
                    {...listeners}
                >
                    ↕
                </button>
            </div>
        </div>
    );
};

const ImagePreview = ({ images, onRemoveImage, onDragEnd, onReset }) => {
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
        <section className="preview-container" aria-labelledby="selected-images-title">
            <div className="preview-header">
                <div className="header-left">
                    <h2 id="selected-images-title">已选图片 ({images.length}/6)</h2>
                    <p>使用排序按钮或拖拽以重新排序</p>
                </div>
                <button type="button" className="reset-btn" onClick={handleReset} title="清空所有图片">
                    清空
                </button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
                announcements={announcements}
                screenReaderInstructions={{ draggable: '按空格键开始排序，使用方向键移动，再按空格键放下。' }}
            >
                <SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}>
                    <div className="preview-grid">
                        {images.map((image, index) => (
                            <SortableItem
                                key={image.id}
                                image={image}
                                index={index}
                                onRemoveImage={onRemoveImage}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
        </section>
    );
};

export default ImagePreview;
