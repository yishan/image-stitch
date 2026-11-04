/**
 * Small promise cache for decoded image bitmaps.
 *
 * Entries are keyed by a caller-supplied string so the cache stays pure and
 * testable in Node. `prune` releases entries that fell out of the active set;
 * a rejected factory is evicted immediately so the next render can retry.
 */
export const createRenderCache = ({ release = () => {} } = {}) => {
    const entries = new Map();
    let created = 0;

    return {
        get(key, factory) {
            const existing = entries.get(key);
            if (existing) return existing.promise;

            created += 1;
            const promise = Promise.resolve()
                .then(factory)
                .catch((error) => {
                    entries.delete(key);
                    throw error;
                });

            entries.set(key, { promise });
            return promise;
        },

        prune(activeKeys) {
            const keep = activeKeys instanceof Set ? activeKeys : new Set(activeKeys);
            let removed = 0;

            for (const [key, entry] of entries) {
                if (keep.has(key)) continue;
                entries.delete(key);
                removed += 1;
                entry.promise.then(
                    (value) => release(value),
                    () => {}
                );
            }

            return removed;
        },

        clear() {
            for (const entry of entries.values()) {
                entry.promise.then(
                    (value) => release(value),
                    () => {}
                );
            }
            entries.clear();
        },

        get stats() {
            return { size: entries.size, created };
        }
    };
};
