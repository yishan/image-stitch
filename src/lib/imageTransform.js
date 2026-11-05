export const DEFAULT_TRANSFORM = Object.freeze({
    rotate: 0,
    flipX: false,
    flipY: false,
    fit: 'contain',
    focusX: 0.5,
    focusY: 0.5
});

export const FIT_MODES = ['contain', 'cover'];
export const ROTATIONS = [0, 90, 180, 270];

export const FOCUS_POSITIONS = [
    ['左上', 0, 0],
    ['上', 0.5, 0],
    ['右上', 1, 0],
    ['左', 0, 0.5],
    ['居中', 0.5, 0.5],
    ['右', 1, 0.5],
    ['左下', 0, 1],
    ['下', 0.5, 1],
    ['右下', 1, 1]
];

const clamp01 = (value, fallback = 0.5) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(1, Math.max(0, numeric));
};

export const normalizeTransform = (value) => {
    const source = value && typeof value === 'object' ? value : {};

    return {
        rotate: ROTATIONS.includes(Number(source.rotate)) ? Number(source.rotate) : 0,
        flipX: Boolean(source.flipX),
        flipY: Boolean(source.flipY),
        fit: FIT_MODES.includes(source.fit) ? source.fit : 'contain',
        focusX: clamp01(source.focusX),
        focusY: clamp01(source.focusY)
    };
};

export const getRotatedDimensions = (width, height, rotate = 0) => (
    rotate === 90 || rotate === 270
        ? { width: height, height: width }
        : { width, height }
);

export const withImageTransform = (images, id, patch) => images.map((image) => (
    image.id === id
        ? { ...image, transform: normalizeTransform({ ...image.transform, ...patch }) }
        : image
));

export const ensureImageTransforms = (images) => images.map((image) => (
    image.transform ? image : { ...image, transform: DEFAULT_TRANSFORM }
));
