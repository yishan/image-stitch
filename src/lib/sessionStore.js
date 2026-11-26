import { sanitizeSettings } from './stitchSettings.js';
import { normalizeTransform } from './imageTransform.js';

const DB_NAME = 'image-stitch-session';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';
const SETTINGS_STORE = 'settings';
const SETTINGS_KEY = 'current';
const IMAGE_REVISION_KEY = 'image-revision';
export const MAX_SESSION_IMAGES = 6;

let imageSnapshot = null;
let imageRevision = null;
let imageWrites = Promise.resolve();
const enqueueImageWrite = (work) => {
    const result = imageWrites.then(work);
    imageWrites = result.catch(() => {});
    return result;
};

export const isSessionStorageAvailable = () => typeof indexedDB !== 'undefined';

const openDatabase = () => new Promise((resolve, reject) => {
    let request;
    try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
        reject(error);
        return;
    }

    request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(IMAGE_STORE)) {
            database.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
            database.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB unavailable'));
});

const requestToPromise = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
});

const transactionDone = (transaction) => new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
});

const withDatabase = async (work) => {
    if (!isSessionStorageAvailable()) return null;
    const database = await openDatabase();
    try {
        return await work(database);
    } finally {
        database.close();
    }
};

/** Pure guard for records read from IndexedDB (also used by tests). */
export const normalizeStoredImages = (records, order) => {
    if (!Array.isArray(records)) return [];
    const validRecords = records.filter((record) => record && typeof record.id === 'string' && record.blob);
    const recordsById = new Map(validRecords.map((record) => [record.id, record]));
    const ordered = Array.isArray(order)
        ? order.flatMap((entry) => {
            const record = recordsById.get(entry?.id);
            return record ? [{ ...record, transform: entry.transform }] : [];
        })
        : validRecords.sort((first, second) => (Number(first.index) || 0) - (Number(second.index) || 0));
    return ordered
        .slice(0, MAX_SESSION_IMAGES)
        .map((record, index) => ({
            id: record.id,
            index,
            name: typeof record.name === 'string' ? record.name : `image-${index + 1}.png`,
            type: typeof record.type === 'string' ? record.type : 'image/png',
            lastModified: Number(record.lastModified) || Date.now(),
            blob: record.blob,
            transform: normalizeTransform(record.transform)
        }));
};

export const saveSessionImages = (images) => enqueueImageWrite(async () => {
    try {
        return await withDatabase(async (database) => {
            const transaction = database.transaction([IMAGE_STORE, SETTINGS_STORE], 'readwrite');
            const store = transaction.objectStore(IMAGE_STORE);
            const settingsStore = transaction.objectStore(SETTINGS_STORE);
            const nextSnapshot = new Map();
            const done = transactionDone(transaction);
            const revisionRecord = await requestToPromise(settingsStore.get(IMAGE_REVISION_KEY));
            if ((revisionRecord?.value ?? null) !== imageRevision) imageSnapshot = null;
            const nextRevision = crypto.randomUUID();
            if (!imageSnapshot) store.clear();
            images.forEach((image, index) => {
                nextSnapshot.set(image.id, image.file);
                if (imageSnapshot?.get(image.id) === image.file) return;
                store.put({
                    id: image.id,
                    name: image.file?.name || `image-${index + 1}.png`,
                    type: image.file?.type || 'image/png',
                    lastModified: image.file?.lastModified || Date.now(),
                    blob: image.file
                });
            });
            imageSnapshot?.forEach((_, id) => {
                if (!nextSnapshot.has(id)) store.delete(id);
            });
            settingsStore.put({
                id: IMAGE_REVISION_KEY,
                value: nextRevision,
                order: images.map(({ id, transform }) => ({ id, transform: normalizeTransform(transform) }))
            });
            await done;
            imageSnapshot = nextSnapshot;
            imageRevision = nextRevision;
            return true;
        }) === true;
    } catch {
        imageSnapshot = null;
        return false;
    }
});

export const saveSessionSettings = async (settings) => {
    try {
        return await withDatabase(async (database) => {
            const transaction = database.transaction(SETTINGS_STORE, 'readwrite');
            transaction.objectStore(SETTINGS_STORE).put({
                id: SETTINGS_KEY,
                value: sanitizeSettings(settings)
            });
            await transactionDone(transaction);
            return true;
        }) === true;
    } catch {
        return false;
    }
};

export const loadSession = async () => {
    try {
        return await withDatabase(async (database) => {
            const transaction = database.transaction([IMAGE_STORE, SETTINGS_STORE], 'readonly');
            const settingsStore = transaction.objectStore(SETTINGS_STORE);
            const [records, revisionRecord, settingsRecord] = await Promise.all([
                requestToPromise(transaction.objectStore(IMAGE_STORE).getAll()),
                requestToPromise(settingsStore.get(IMAGE_REVISION_KEY)),
                requestToPromise(settingsStore.get(SETTINGS_KEY))
            ]);
            const images = normalizeStoredImages(records, revisionRecord?.order).map((record) => ({
                ...record,
                file: new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified })
            }));
            imageSnapshot = new Map(images.map(({ id, file }) => [id, file]));
            imageRevision = revisionRecord?.value ?? null;
            const hasSettings = Boolean(settingsRecord?.value);
            if (images.length === 0 && !hasSettings) return null;
            return {
                images,
                settings: hasSettings ? sanitizeSettings(settingsRecord.value) : null
            };
        });
    } catch {
        return null;
    }
};

export const clearSession = () => enqueueImageWrite(async () => {
    imageSnapshot = null;
    imageRevision = null;
    try {
        return await withDatabase(async (database) => {
            const transaction = database.transaction([IMAGE_STORE, SETTINGS_STORE], 'readwrite');
            transaction.objectStore(IMAGE_STORE).clear();
            transaction.objectStore(SETTINGS_STORE).clear();
            await transactionDone(transaction);
            return true;
        }) === true;
    } catch {
        return false;
    }
});
