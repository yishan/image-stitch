import { useRef, useState } from 'react';
import { normalizeRedaction } from '../lib/redaction.js';
import { AlertIcon } from './ui-icons.jsx';

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

const StitchStage = ({
    canvasRef,
    isGenerating,
    error,
    canvasUrl,
    output,
    previewMode,
    redactMode = false,
    onAddRedaction,
    onRetry
}) => {
    const showPreview = Boolean(canvasUrl) && !error;
    const stageRef = useRef(null);
    const imageRef = useRef(null);
    const dragRef = useRef(null);
    const [drag, setDrag] = useState(null);

    const pointFor = (event, clampOutside = false) => {
        const image = imageRef.current;
        const stage = stageRef.current;
        if (!image || !stage) return null;
        const imageBox = image.getBoundingClientRect();
        const stageBox = stage.getBoundingClientRect();
        const nx = (event.clientX - imageBox.left) / imageBox.width;
        const ny = (event.clientY - imageBox.top) / imageBox.height;
        if (!clampOutside && (nx < 0 || nx > 1 || ny < 0 || ny > 1)) return null;

        return {
            x: clamp01(nx),
            y: clamp01(ny),
            box: {
                left: imageBox.left - stageBox.left,
                top: imageBox.top - stageBox.top,
                width: imageBox.width,
                height: imageBox.height
            }
        };
    };

    const handlePointerDown = (event) => {
        if (!redactMode || !showPreview) return;
        const point = pointFor(event);
        if (!point) return;

        event.preventDefault();
        event.currentTarget.focus?.({ preventScroll: true });
        if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        dragRef.current = {
            pointerId: event.pointerId,
            box: point.box,
            startX: point.x,
            startY: point.y,
            lastX: point.x,
            lastY: point.y
        };
        setDrag({
            box: point.box,
            startX: point.x,
            startY: point.y,
            x: point.x,
            y: point.y
        });
    };

    const handlePointerMove = (event) => {
        const active = dragRef.current;
        if (!active || active.pointerId !== event.pointerId) return;
        const point = pointFor(event, true);
        if (!point) return;

        event.preventDefault();
        active.lastX = point.x;
        active.lastY = point.y;
        setDrag((previous) => (previous ? { ...previous, x: point.x, y: point.y } : previous));
    };

    const finishDrag = (event) => {
        const active = dragRef.current;
        if (!active) return;
        dragRef.current = null;

        if (event?.currentTarget?.hasPointerCapture?.(active.pointerId)) {
            event.currentTarget.releasePointerCapture(active.pointerId);
        }

        const rectangle = normalizeRedaction({
            x: Math.min(active.startX, active.lastX),
            y: Math.min(active.startY, active.lastY),
            width: Math.abs(active.lastX - active.startX),
            height: Math.abs(active.lastY - active.startY)
        });
        setDrag(null);
        if (rectangle.width > 0.002 && rectangle.height > 0.002) {
            onAddRedaction?.(rectangle);
        }
    };

    const previewStyle = drag ? (() => {
        const x = Math.min(drag.startX, drag.x);
        const y = Math.min(drag.startY, drag.y);
        return {
            left: drag.box.left + x * drag.box.width,
            top: drag.box.top + y * drag.box.height,
            width: Math.abs(drag.x - drag.startX) * drag.box.width,
            height: Math.abs(drag.y - drag.startY) * drag.box.height
        };
    })() : null;

    return (
        <div className="stage" aria-busy={isGenerating} data-preview-mode={previewMode} ref={stageRef}>
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
                    <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
                        重试
                    </button>
                </div>
            )}

            {showPreview && (
                <img
                    ref={imageRef}
                    src={canvasUrl}
                    alt={output ? `拼接结果预览，${output.width} × ${output.height} 像素` : '拼接结果预览'}
                    className="result-image"
                    width={output?.width}
                    height={output?.height}
                />
            )}

            {redactMode && showPreview && (
                <div
                    className="redaction-layer"
                    role="group"
                    aria-label="打码框选区域；在结果图上拖动创建马赛克或色块"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onLostPointerCapture={finishDrag}
                >
                    {!drag && <span className="redaction-layer__hint">拖动框选要打码的区域</span>}
                    {drag && previewStyle && (
                        <span className="redaction-drag" style={previewStyle} aria-hidden="true" />
                    )}
                </div>
            )}
        </div>
    );
};

export default StitchStage;
