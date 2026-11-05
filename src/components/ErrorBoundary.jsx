import { Component } from 'react';
import { useI18n } from '../i18n/index.jsx';
import './ErrorBoundary.css';

const CrashIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 12h12M10 16h12M10 20h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
        <path d="M17 24.5c2.5 0 2.5-4 5-4" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

const CrashFallback = ({ onRetry, onReload, detail }) => {
    const { t } = useI18n();

    return (
        <main className="crash" role="alert">
            <div className="crash__inner">
                <CrashIcon />
                <h1>{t('crash.title')}</h1>
                <p>{t('crash.description')}</p>
                <div className="crash__actions">
                    <button type="button" className="btn btn--secondary" onClick={onRetry}>
                        {t('common.retry')}
                    </button>
                    <button type="button" className="btn btn--primary" onClick={onReload}>
                        {t('crash.reload')}
                    </button>
                </div>
                {detail && <pre className="crash__detail">{detail}</pre>}
            </div>
        </main>
    );
};

class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Unhandled interface error', error, info?.componentStack);
    }

    handleRetry = () => {
        this.setState({ error: null });
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <CrashFallback
                onRetry={this.handleRetry}
                onReload={this.handleReload}
                detail={import.meta.env.DEV ? this.state.error?.message : ''}
            />
        );
    }
}

export default ErrorBoundary;
