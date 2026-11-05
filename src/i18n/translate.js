import en from './messages.en.js';
import zh from './messages.zh.js';

const MESSAGES = { zh, en };
export const LOCALES = ['zh', 'en'];
const STORAGE_KEY = 'locale';
const DEFAULT_LOCALE = 'zh';

export const resolveLocale = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (LOCALES.includes(stored)) return stored;
    } catch {
        // localStorage may be unavailable in private mode.
    }

    const languages = typeof navigator !== 'undefined'
        ? (navigator.languages?.length ? navigator.languages : [navigator.language])
        : [];
    return languages.some((language) => /^zh/i.test(language || '')) ? 'zh' : 'en';
};

const read = (dictionary, key) => key.split('.').reduce((value, part) => (
    value && typeof value === 'object' ? value[part] : undefined
), dictionary);

const interpolate = (template, params) => template.replace(/\{(\w+)\}/g, (match, name) => (
    params[name] === undefined || params[name] === null ? match : String(params[name])
));

export const translate = (locale, key, params = {}) => {
    const value = read(MESSAGES[locale], key) ?? read(MESSAGES[DEFAULT_LOCALE], key);
    return typeof value === 'string' ? interpolate(value, params) : key;
};
