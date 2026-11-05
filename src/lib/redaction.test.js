import test from 'node:test';
import assert from 'node:assert/strict';
import { getRedactionColor, isUsableRedaction, normalizeRedaction } from './redaction.js';

test('normalizeRedaction clamps a rectangle to the image', () => {
    assert.deepEqual(normalizeRedaction({ x: -0.2, y: 0.3, width: 0.5, height: 1 }), {
        x: 0,
        y: 0.3,
        width: 0.5,
        height: 0.7
    });
    assert.deepEqual(normalizeRedaction({ x: 0.8, y: 0.8, width: 0.5, height: 0.5 }), {
        x: 0.8,
        y: 0.8,
        width: 1 - 0.8,
        height: 1 - 0.8
    });
});

test('getRedactionColor falls back to ink for invalid colors', () => {
    assert.equal(getRedactionColor('#ff0000'), '#ff0000');
    assert.equal(getRedactionColor('red'), '#201c17');
    assert.equal(getRedactionColor(undefined), '#201c17');
});

test('isUsableRedaction rejects accidental taps', () => {
    assert.equal(isUsableRedaction({ width: 0.001, height: 0.4 }), false);
    assert.equal(isUsableRedaction({ width: 0.1, height: 0.1 }), true);
});
