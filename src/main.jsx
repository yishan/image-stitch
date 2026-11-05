import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { I18nProvider } from './i18n/index.jsx'

if (import.meta.env.DEV) {
  import('./lib/stitchRenderer.js').then(({ getRenderCacheStats }) => {
    window.__stitchDebug = { getRenderCacheStats };
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
