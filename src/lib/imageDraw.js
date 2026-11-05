/**
 * Draw one image into an axis-aligned rect, applying rotation, flips, fit and
 * the focus offset. Shared by the export renderer and the focus editor preview.
 */
export const drawTransformedImage = (ctx, image, transform = {}, rect, options = {}) => {
    const rotate = Number(transform.rotate) || 0;
    const flipX = Boolean(transform.flipX);
    const flipY = Boolean(transform.flipY);
    const fit = options.fit || (transform.fit === 'cover' ? 'cover' : 'contain');
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    const rotatedWidth = rotate % 180 === 0 ? imageWidth : imageHeight;
    const rotatedHeight = rotate % 180 === 0 ? imageHeight : imageWidth;

    const zoom = fit === 'cover' && Number.isFinite(options.zoom)
        ? Math.min(3, Math.max(1, options.zoom))
        : 1;
    const baseScale = fit === 'cover'
        ? Math.max(rect.width / rotatedWidth, rect.height / rotatedHeight)
        : Math.min(1, rect.width / rotatedWidth, rect.height / rotatedHeight);
    const scale = baseScale * zoom;
    const scaledWidth = rotatedWidth * scale;
    const scaledHeight = rotatedHeight * scale;

    const focusX = fit === 'cover'
        ? (Number.isFinite(options.focusX) ? options.focusX : transform.focusX ?? 0.5)
        : 0.5;
    const focusY = fit === 'cover'
        ? (Number.isFinite(options.focusY) ? options.focusY : transform.focusY ?? 0.5)
        : 0.5;

    // Focus slides the cropped image inside the rect: 0 = left/top edge,
    // 0.5 = centred, 1 = right/bottom edge. When the image is not cropped the
    // offsets cancel out.
    const offsetX = (rect.width - scaledWidth) * focusX;
    const offsetY = (rect.height - scaledHeight) * focusY;

    ctx.save();
    ctx.translate(
        rect.x + offsetX + scaledWidth / 2,
        rect.y + offsetY + scaledHeight / 2
    );
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.drawImage(
        image,
        -(imageWidth * scale) / 2,
        -(imageHeight * scale) / 2,
        imageWidth * scale,
        imageHeight * scale
    );
    ctx.restore();
};
