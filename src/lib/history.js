/**
 * Small undo/redo history. The caller supplies immutable snapshots; this module
 * only manages past/present/future and time-based coalescing (sliders).
 */
export const createHistory = (present, { limit = 12 } = {}) => ({
    present,
    past: [],
    future: [],
    limit,
    lastPush: null
});

export const pushHistory = (history, next, { coalesceKey = null, coalesceMs = 600, now = Date.now() } = {}) => {
    const last = history.lastPush;
    if (coalesceKey && last && last.key === coalesceKey && now - last.at < coalesceMs) {
        return {
            ...history,
            present: next,
            future: [],
            lastPush: { key: coalesceKey, at: now }
        };
    }

    return {
        ...history,
        present: next,
        past: [...history.past, history.present].slice(-history.limit),
        future: [],
        lastPush: { key: coalesceKey, at: now }
    };
};

export const undoHistory = (history) => {
    if (history.past.length === 0) return history;
    const previous = history.past[history.past.length - 1];

    return {
        ...history,
        present: previous,
        past: history.past.slice(0, -1),
        future: [history.present, ...history.future].slice(0, history.limit),
        lastPush: null
    };
};

export const redoHistory = (history) => {
    if (history.future.length === 0) return history;
    const [next, ...rest] = history.future;

    return {
        ...history,
        present: next,
        past: [...history.past, history.present].slice(-history.limit),
        future: rest,
        lastPush: null
    };
};

export const resetHistory = (present, { limit = 12 } = {}) => ({
    present,
    past: [],
    future: [],
    limit,
    lastPush: null
});

export const historySnapshots = (history) => [...history.past, history.present, ...history.future];
