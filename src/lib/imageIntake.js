export const MAX_IMAGE_COUNT = 6;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const isImageFile = (file) => file?.type?.startsWith('image/');

const createDefaultId = () => (
    globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)
);

export const addImageFiles = (existingImages, files, options = {}) => {
    const {
        maxImages = MAX_IMAGE_COUNT,
        maxFileBytes = MAX_FILE_BYTES,
        createUrl = (file) => URL.createObjectURL(file),
        createId = createDefaultId
    } = options;
    const sourceFiles = Array.from(files || []);
    const imageFiles = sourceFiles.filter(isImageFile);
    const sizeValidFiles = imageFiles.filter((file) => (
        typeof file.size !== 'number' || file.size <= maxFileBytes
    ));
    const availableSlots = Math.max(0, maxImages - existingImages.length);
    const acceptedFiles = sizeValidFiles.slice(0, availableSlots);
    const addedImages = acceptedFiles.map((file) => ({
        id: createId(file),
        file,
        url: createUrl(file)
    }));

    return {
        images: [...existingImages, ...addedImages],
        addedImages,
        rejected: {
            nonImage: sourceFiles.length - imageFiles.length,
            tooLarge: imageFiles.length - sizeValidFiles.length,
            overLimit: Math.max(0, sizeValidFiles.length - acceptedFiles.length)
        }
    };
};

export const releaseImageUrls = (images, revokeUrl = (url) => URL.revokeObjectURL(url)) => {
    images.forEach((image) => {
        if (image?.url) revokeUrl(image.url);
    });
};

export const removeImage = (images, id, revokeUrl = (url) => URL.revokeObjectURL(url)) => {
    const removedImage = images.find((image) => image.id === id);

    if (removedImage?.url) revokeUrl(removedImage.url);

    return images.filter((image) => image.id !== id);
};
