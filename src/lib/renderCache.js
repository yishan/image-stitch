/**
 * Decoded-bitmap cache.
 *
 * Entries are keyed by stable image identity (`id|url`) instead of the decode
 * budget, so adding/removing a sibling image does not force the survivors to
 * be re-decoded. When the requested budget changes:
 *   - a cached image that is already large enough is reused (or downscaled),
 *   - a cached image that is too small is re-decoded once at the larger budget.
 *
 * `bounds(sourceWidth, sourceHeight, budget)` returns the target dimensions for
 * a budget; `resize(image, target)` produces a smaller bitmap without touching
 * the original URL; `release(image)` frees bitmaps/object URLs.
 */
export const createRenderCache = ({
    bounds,
    resize,
    release = () => {}
} = {}) => {
    const entries = new Map();
    let created = 0;

    const decodeAndStore = (key, budget, decode) => {
        created += 1;
        const promise = Promise.resolve()
            .then(() => decode(budget))
            .then((value) => ({ ...value, budget }))
            .catch((error) => {
                entries.delete(key);
                throw error;
            });
        entries.set(key, { promise });
        return promise;
    };

    const get = async (key, budget, decode) => {
        let entry = entries.get(key);
        if (!entry) entry = { promise: decodeAndStore(key, budget, decode) };

        const value = await entry.promise;
        const target = bounds(value.sourceWidth, value.sourceHeight, budget);
        const image = value.image;

        if (image.width === target.width && image.height === target.height) {
            return image;
        }

        if (image.width >= target.width && image.height >= target.height) {
            const resized = await resize(image, target);
            if (resized !== image) release(image);
            entries.set(key, {
                promise: Promise.resolve({ ...value, image: resized, budget })
            });
            return resized;
        }

        // Cached bitmap is smaller than the new budget allows -> decode again.
        const next = await decodeAndStore(key, budget, decode);
        release(value.image);
        entries.set(key, { promise: Promise.resolve(next) });
        return next.image;
    };

    const prune = (activeKeys) => {
        const keep = activeKeys instanceof Set ? activeKeys : new Set(activeKeys);
        let removed = 0;

        for (const [key, entry] of entries) {
            if (keep.has(key)) continue;
            entries.delete(key);
            removed += 1;
            entry.promise.then(
                (value) => release(value.image),
                () => {}
            );
        }

        return removed;
    };

    const clear = () => {
        for (const entry of entries.values()) {
            entry.promise.then(
                (value) => release(value.image),
                () => {}
            );
        }
        entries.clear();
    };

    return {
        get,
        prune,
        clear,
        get stats() {
            return { size: entries.size, created };
        }
    };
};
