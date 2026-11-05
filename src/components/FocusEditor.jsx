import { useCallback, useEffect, useRef, useState } from 'react';
import { drawTransformedImage } from '../lib/imageDraw.js';
import { normalizeTransform } from '../lib/imageTransform.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const FocusEditor = ({ image, index, cellAspect, onChange }) => {
    const transform = normalizeTransform(image.transform);
    const [draft, setDraft] = useState(null);
    const focus = draft || { x: transform.focusX, y: transform.focusY };
    const zoom = transform.zoom;
    const canvasRef = useRef(null);
    const hostRef = useRef(null);
    const sourceRef = useRef(null);
    const drawRef = useRef(() => {});
    const dragRef = useRef(null);
    const hintId = `focus-hint-${image.id}`;

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const host = hostRef.current;
        const source = sourceRef.current;
        if (!canvas || !host || !source) return;

        const box = host.getBoundingClientRect();
        if (box.width < 1 || box.height < 1) return;

        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(box.width * dpr);
        const height = Math.round(box.height * dpr);
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, box.width, box.height);
        drawTransformedImage(
            ctx,
            source,
            transform,
            { x: 0, y: 0, width: box.width, height: box.height },
            { fit: 'cover', focusX: focus.x, focusY: focus.y, zoom }
        );
    }, [transform, focus.x, focus.y, zoom]);

    useEffect(() => {
        drawRef.current = draw;
        draw();
    }, [draw]);

    useEffect(() => {
        let cancelled = false;
        const source = new Image();
        source.decoding = 'async';
        source.onload = () => {
            if (cancelled) return;
            sourceRef.current = source;
            drawRef.current();
        };
        source.src = image.url;

        return () => {
            cancelled = true;
            source.onload = null;
        };
    }, [image.url]);

    useEffect(() => {
        const host = hostRef.current;
        if (!host || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => drawRef.current());
        observer.observe(host);
        return () => observer.disconnect();
    }, []);

    const metrics = () => {
        const host = hostRef.current;
        const source = sourceRef.current;
        if (!host || !source) return null;

        const box = host.getBoundingClientRect();
        const width = source.naturalWidth || source.width;
        const height = source.naturalHeight || source.height;
        const rotated = transform.rotate === 90 || transform.rotate === 270;
        const rotatedWidth = rotated ? height : width;
        const rotatedHeight = rotated ? width : height;
        const scale = Math.max(box.width / rotatedWidth, box.height / rotatedHeight) * zoom;

        return {
            boxWidth: box.width,
            boxHeight: box.height,
            overflowX: Math.max(0, rotatedWidth * scale - box.width),
            overflowY: Math.max(0, rotatedHeight * scale - box.height)
        };
    };

    const handlePointerDown = (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        const size = metrics();
        if (!size) return;

        event.currentTarget.focus({ preventScroll: true });
        if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }

        const start = { x: transform.focusX, y: transform.focusY };
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            start,
            last: start,
            moved: false,
            ...size
        };
        setDraft(start);
    };

    const handlePointerMove = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (event.cancelable) event.preventDefault();

        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        const next = {
            x: drag.overflowX > 0.5
                ? clamp01(drag.start.x - dx / drag.overflowX)
                : drag.start.x,
            y: drag.overflowY > 0.5
                ? clamp01(drag.start.y - dy / drag.overflowY)
                : drag.start.y
        };

        drag.last = next;
        drag.moved = drag.moved || Math.abs(dx) + Math.abs(dy) > 2;
        setDraft(next);
    };

    const finishDrag = (event) => {
        const drag = dragRef.current;
        if (!drag) return;
        dragRef.current = null;

        if (event?.currentTarget?.hasPointerCapture?.(drag.pointerId)) {
            event.currentTarget.releasePointerCapture(drag.pointerId);
        }

        const finalFocus = drag.last;
        setDraft(null);

        const changed = Math.abs(finalFocus.x - transform.focusX) > 0.0001
            || Math.abs(finalFocus.y - transform.focusY) > 0.0001;
        if (drag.moved && changed) {
            onChange(image.id, { focusX: finalFocus.x, focusY: finalFocus.y });
        }
    };

    const handleKeyDown = (event) => {
        const step = event.shiftKey ? 0.1 : 0.02;
        let dx = 0;
        let dy = 0;

        switch (event.key) {
            case 'ArrowLeft': dx = -step; break;
            case 'ArrowRight': dx = step; break;
            case 'ArrowUp': dy = -step; break;
            case 'ArrowDown': dy = step; break;
            default: return;
        }

        event.preventDefault();
        onChange(
            image.id,
            {
                focusX: clamp01(transform.focusX + dx),
                focusY: clamp01(transform.focusY + dy)
            },
            { coalesceKey: `focus:${image.id}` }
        );
    };

    const percent = (value) => `${Math.round(value * 100)}%`;
    const zoomId = `focus-zoom-${image.id}`;

    return (
        <div className="focus-editor-wrap">
            <div className="adjustments__focus-head">
                <span className="adjustments__label">焦点</span>
                <span className="focus-editor__value focus-editor__focus-value mono" aria-hidden="true">
                    {percent(focus.x)} / {percent(focus.y)}
                </span>
            </div>

            <div className="focus-zoom">
                <label className="adjustments__label" htmlFor={zoomId}>缩放</label>
                <input
                    id={zoomId}
                    type="range"
                    aria-label="图片缩放"
                    min="1"
                    max="3"
                    step="0.05"
                    value={zoom}
                    aria-valuetext={`${Math.round(zoom * 100)}%`}
                    onChange={(event) => onChange(
                        image.id,
                        { zoom: Number(event.target.value) },
                        { coalesceKey: `zoom:${image.id}` }
                    )}
                />
                <span className="focus-editor__value focus-editor__zoom-value mono" aria-hidden="true">{percent(zoom)}</span>
            </div>

            <div
                ref={hostRef}
                className={`focus-editor${draft ? ' is-dragging' : ''}`}
                style={{ aspectRatio: cellAspect }}
                role="group"
                tabIndex={0}
                aria-label={`第 ${index + 1} 张图片焦点预览，当前横向 ${percent(focus.x)}、纵向 ${percent(focus.y)}；拖动图片或用方向键调整`}
                aria-describedby={hintId}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onLostPointerCapture={finishDrag}
                onKeyDown={handleKeyDown}
            >
                <canvas ref={canvasRef} className="focus-editor__canvas" aria-hidden="true" />
                <span className="focus-editor__crosshair" aria-hidden="true" />
            </div>

            <p className="field-hint" id={hintId}>
                拖动图片调整裁切位置（只有超出单元格的方向会移动）；方向键微调，Shift 加速。
            </p>
        </div>
    );
};

export default FocusEditor;
