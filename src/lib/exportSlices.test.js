import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildImagePdf,
    getSliceCount,
    getSliceRanges,
    sliceFilename
} from './exportSlices.js';

test('getSliceRanges splits a tall image into ordered ranges', () => {
    assert.deepEqual(getSliceRanges(3200, 0), [{ index: 0, y: 0, height: 3200 }]);
    assert.deepEqual(getSliceRanges(3200, 4096), [{ index: 0, y: 0, height: 3200 }]);
    assert.deepEqual(getSliceRanges(5000, 2048), [
        { index: 0, y: 0, height: 2048 },
        { index: 1, y: 2048, height: 2048 },
        { index: 2, y: 4096, height: 904 }
    ]);
    assert.equal(getSliceCount(5000, 2048), 3);
});

test('slice filenames sort naturally', () => {
    assert.equal(sliceFilename('stitch-vertical-20261105', 0, 3, 'png'), 'stitch-vertical-20261105-part-01-of-03.png');
    assert.equal(sliceFilename('stitch-vertical-20261105', 2, 12, 'jpg'), 'stitch-vertical-20261105-part-03-of-12.jpg');
});

test('buildImagePdf writes one JPEG page per slice', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildImagePdf([
        { width: 500, height: 2048, jpeg },
        { width: 500, height: 1152, jpeg }
    ]);
    const text = new TextDecoder().decode(pdf);

    assert.ok(text.startsWith('%PDF-1.4'));
    assert.ok(text.trimEnd().endsWith('%%EOF'));
    assert.match(text, /\/Count 2/);
    assert.equal((text.match(/\/Type \/Page\s/g) || []).length, 2);
    assert.equal((text.match(/\/Subtype \/Image/g) || []).length, 2);
    assert.match(text, /\/MediaBox \[0 0 500 2048\]/);
    assert.match(text, /\/Filter \/DCTDecode/);

    // The xref entry for object 1 must point at its actual header.
    const xref = text.slice(text.lastIndexOf('\nxref\n'));
    const firstOffset = Number(xref.match(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/)[1]);
    assert.equal(text.slice(firstOffset, firstOffset + 7), '1 0 obj');
});
