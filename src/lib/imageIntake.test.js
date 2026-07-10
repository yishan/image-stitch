import test from 'node:test';
import assert from 'node:assert/strict';

const loadIntakeModule = async () => {
    const intake = await import('./imageIntake.js').catch(() => ({}));

    assert.equal(
        typeof intake.addImageFiles,
        'function',
        'addImageFiles should be exported'
    );

    return intake;
};

test('image intake accepts only remaining image slots and reports ignored files', async () => {
    const { addImageFiles } = await loadIntakeModule();
    const existingImages = Array.from({ length: 5 }, (_, index) => ({ id: `existing-${index}` }));
    const createdUrls = [];
    const files = [
        { name: 'one.png', type: 'image/png' },
        { name: 'two.png', type: 'image/png' },
        { name: 'notes.txt', type: 'text/plain' }
    ];

    const result = addImageFiles(existingImages, files, {
        createUrl(file) {
            const url = `blob:${file.name}`;
            createdUrls.push(url);
            return url;
        },
        createId(file) {
            return file.name;
        }
    });

    assert.equal(result.images.length, 6);
    assert.deepEqual(createdUrls, ['blob:one.png']);
    assert.equal(result.rejected.nonImage, 1);
    assert.equal(result.rejected.overLimit, 1);
});

test('removing an image revokes only its object URL', async () => {
    const { removeImage } = await loadIntakeModule();
    const revokedUrls = [];
    const images = [
        { id: 'one', url: 'blob:one' },
        { id: 'two', url: 'blob:two' }
    ];

    const remainingImages = removeImage(images, 'one', (url) => revokedUrls.push(url));

    assert.deepEqual(remainingImages, [{ id: 'two', url: 'blob:two' }]);
    assert.deepEqual(revokedUrls, ['blob:one']);
});

test('rejects image files larger than 10 MiB before creating an object URL', async () => {
    const { addImageFiles } = await loadIntakeModule();
    const createdUrls = [];
    const files = [
        { name: 'small.png', type: 'image/png', size: 1024 },
        { name: 'large.png', type: 'image/png', size: 10 * 1024 * 1024 + 1 }
    ];

    const result = addImageFiles([], files, {
        createUrl(file) {
            createdUrls.push(file.name);
            return `blob:${file.name}`;
        },
        createId: (file) => file.name
    });

    assert.deepEqual(createdUrls, ['small.png']);
    assert.equal(result.images.length, 1);
    assert.equal(result.rejected.tooLarge, 1);
});
