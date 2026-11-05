import { useI18n } from '../i18n/index.jsx';
import './LocaleSwitcher.css';

const LocaleSwitcher = () => {
    const { locale, setLocale, t } = useI18n();

    return (
        <div className="locale-switcher" role="group" aria-label={t('locale.label')}>
            <button
                type="button"
                className={locale === 'zh' ? 'is-active' : ''}
                aria-pressed={locale === 'zh'}
                aria-label={t('locale.zh')}
                onClick={() => setLocale('zh')}
            >
                中
            </button>
            <button
                type="button"
                className={locale === 'en' ? 'is-active' : ''}
                aria-pressed={locale === 'en'}
                aria-label={t('locale.en')}
                onClick={() => setLocale('en')}
            >
                EN
            </button>
        </div>
    );
};

export default LocaleSwitcher;
