import { useI18n } from '../i18n/index.jsx';
import './ThemeSwitcher.css';

const SunIcon = () => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <circle cx="10" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 2.2v1.8M10 16v1.8M2.2 10H4M16 10h1.8M4.5 4.5l1.3 1.3M14.2 14.2l1.3 1.3M15.5 4.5l-1.3 1.3M5.8 14.2l-1.3 1.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

const MoonIcon = () => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path d="M16.5 12.2A6.8 6.8 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
);

const ThemeSwitcher = ({ theme, toggleTheme }) => {
    const { t } = useI18n();
    const label = theme === 'light' ? t('theme.toDark') : t('theme.toLight');

    return (
        <button
            type="button"
            className="theme-switcher"
            onClick={toggleTheme}
            aria-label={label}
            title={label}
        >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>
    );
};

export default ThemeSwitcher;
