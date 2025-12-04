import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
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
        transform,
        transition,
        isDragging,
    }
        = useSortable({ id: image.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="preview-item"
        >
            <div className="image-wrapper">
                <img src={image.url} alt={`Upload ${index + 1}`} />
                <button
                    className="remove-btn"
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag start on click
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemoveImage(image.id);
                    }}
                    title="移除图片"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <span className="image-index">{index + 1}</span>
        </div>
    );
};

const ImagePreview = ({ images, onRemoveImage, onDragEnd, onReset }) => {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!images || images.length === 0) return null;

    return (
        <div className="preview-container">
            <div className="preview-header">
                <div className="header-left">
                    <h3>已选图片 ({images.length}/6)</h3>
                    <p>拖拽以重新排序</p>
                </div>
                <button className="reset-btn" onClick={onReset} title="清空所有图片">
                    清空
                </button>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
            >
                <SortableContext
                    items={images.map(img => img.id)}
                    strategy={rectSortingStrategy}
                >
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
        </div>
    );
};

export default ImagePreview;
