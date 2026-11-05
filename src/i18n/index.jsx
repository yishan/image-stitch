/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LOCALES, resolveLocale, translate } from './translate.js';

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
    const [locale, setLocaleState] = useState(resolveLocale);

    const setLocale = useCallback((next) => {
        if (!LOCALES.includes(next)) return;
        setLocaleState(next);
        try {
            localStorage.setItem('locale', next);
        } catch {
            // Ignore storage failures; the in-memory locale still works.
        }
    }, []);

    const t = useCallback((key, params) => translate(locale, key, params), [locale]);

    useEffect(() => {
        document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
        document.documentElement.dataset.locale = locale;
        document.title = t('meta.title');

        const description = document.querySelector('meta[name="description"]');
        if (description) description.setAttribute('content', t('meta.description'));
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', t('meta.ogTitle'));
        const ogDescription = document.querySelector('meta[property="og:description"]');
        if (ogDescription) ogDescription.setAttribute('content', t('meta.ogDescription'));
    }, [locale, t]);

    const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
    const context = useContext(I18nContext);
    if (!context) throw new Error('useI18n must be used inside I18nProvider');
    return context;
};
