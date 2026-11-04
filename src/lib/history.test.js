import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, pushHistory, redoHistory, resetHistory, undoHistory } from './history.js';

test('history pushes snapshots and undoes/redoes them', () => {
    let history = createHistory({ value: 1 });
    history = pushHistory(history, { value: 2 });
    history = pushHistory(history, { value: 3 });

    assert.equal(history.present.value, 3);
    assert.equal(history.past.length, 2);

    history = undoHistory(history);
    assert.equal(history.present.value, 2);
    assert.equal(history.future.length, 1);

    history = undoHistory(history);
    assert.equal(history.present.value, 1);

    history = undoHistory(history);
    assert.equal(history.present.value, 1, 'undo at the start is a no-op');

    history = redoHistory(history);
    history = redoHistory(history);
    assert.equal(history.present.value, 3);
    assert.equal(redoHistory(history).present.value, 3, 'redo at the end is a no-op');
});

test('a new change clears the redo stack', () => {
    let history = createHistory(1);
    history = pushHistory(history, 2);
    history = undoHistory(history);
    history = pushHistory(history, 3);

    assert.equal(history.present, 3);
    assert.equal(history.future.length, 0);
});

test('history is capped at the configured limit', () => {
    let history = createHistory(0, { limit: 3 });
    [1, 2, 3, 4, 5].forEach((value) => {
        history = pushHistory(history, value);
    });

    assert.equal(history.past.length, 3);
    assert.deepEqual(history.past.map((snapshot) => snapshot), [2, 3, 4]);
});

test('coalesced pushes replace the present without adding history entries', () => {
    let history = createHistory(0);
    history = pushHistory(history, 1, { coalesceKey: 'settings', now: 1000 });
    history = pushHistory(history, 2, { coalesceKey: 'settings', now: 1200 });
    history = pushHistory(history, 3, { coalesceKey: 'settings', now: 1400 });

    assert.equal(history.present, 3);
    assert.equal(history.past.length, 1, 'a slider burst is one undo step');
    assert.equal(history.past[0], 0);

    history = pushHistory(history, 4, { coalesceKey: 'settings', now: 3000 });
    assert.equal(history.past.length, 2);
});

test('resetHistory keeps the value and clears stacks', () => {
    let history = createHistory(1);
    history = pushHistory(history, 2);
    history = undoHistory(history);
    history = resetHistory(42);

    assert.equal(history.present, 42);
    assert.equal(history.past.length, 0);
    assert.equal(history.future.length, 0);
});
