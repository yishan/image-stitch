import { Component } from 'react';
import './ErrorBoundary.css';

const CrashIcon = () => (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
        <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 12h12M10 16h12M10 20h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
        <path d="M17 24.5c2.5 0 2.5-4 5-4" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
);

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
            <main className="crash" role="alert">
                <div className="crash__inner">
                    <CrashIcon />
                    <h1>界面出了点问题</h1>
                    <p>图片仍然只在本机，没有被上传。可以先重试；如果还是失败，重新加载页面。</p>
                    <div className="crash__actions">
                        <button type="button" className="btn btn--secondary" onClick={this.handleRetry}>
                            重试
                        </button>
                        <button type="button" className="btn btn--primary" onClick={this.handleReload}>
                            重新加载
                        </button>
                    </div>
                    {import.meta.env.DEV && this.state.error?.message && (
                        <pre className="crash__detail">{this.state.error.message}</pre>
                    )}
                </div>
            </main>
        );
    }
}

export default ErrorBoundary;
