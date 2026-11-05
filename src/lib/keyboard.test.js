import test from 'node:test';
import assert from 'node:assert/strict';
import { isEditableTarget } from './keyboard.js';

const target = (field) => ({ closest: () => field });

test('isEditableTarget ignores non-text inputs but protects text fields', () => {
    assert.equal(isEditableTarget(null), false);
    assert.equal(isEditableTarget({}), false);
    assert.equal(isEditableTarget(target({ tagName: 'INPUT', type: 'range' })), false);
    assert.equal(isEditableTarget(target({ tagName: 'INPUT', type: 'checkbox' })), false);
    assert.equal(isEditableTarget(target({ tagName: 'INPUT', type: 'text' })), true);
    assert.equal(isEditableTarget(target({ tagName: 'TEXTAREA', type: undefined })), true);
    assert.equal(isEditableTarget(target({ tagName: 'SELECT', type: undefined })), true);
});
