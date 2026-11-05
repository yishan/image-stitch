import { useState, useEffect, useCallback, useRef } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import './App.css';
import ImageUploader from './components/ImageUploader';
import ImagePreview from './components/ImagePreview';
import StitchCanvas from './components/StitchCanvas';
import ThemeSwitcher from './components/ThemeSwitcher';
import {
  MAX_IMAGE_COUNT,
  MAX_FILE_BYTES,
  addImageFiles,
  removeImage
} from './lib/imageIntake';
import {
  createHistory,
  historySnapshots,
  pushHistory,
  redoHistory,
  resetHistory,
  undoHistory
} from './lib/history';
import { DEFAULT_SETTINGS } from './lib/stitchSettings';
import { ensureImageTransforms, normalizeTransform, withImageTransform } from './lib/imageTransform';
import { isEditableTarget } from './lib/keyboard';
import {
  clearSession,
  isSessionStorageAvailable,
  loadSession,
  saveSessionImages,
  saveSessionSettings
} from './lib/sessionStore';

const THEME_COLORS = {
  light: '#f6f3ed',
  dark: '#13110f'
};

const getInitialTheme = () => document.documentElement.dataset.theme || 'light';

const BrandMark = () => (
  <svg
    className="brand-mark"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
    <path
      d="M3 12.5c2 0 2-2.5 4-2.5s2 2.5 4 2.5 2-2.5 4-2.5 2 2.5 4 2.5"
      stroke="var(--accent)"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const EmptyStage = () => (
  <div className="empty-stage">
    <div className="empty-stage__inner">
      <svg className="empty-mark" viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
        <rect x="4" y="4" width="48" height="48" rx="3" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M4 28c6 0 6-6 12-6s6 6 12 6 6-6 12-6 6 6 12 6"
          stroke="var(--accent)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path d="M4 36c6 0 6-6 12-6s6 6 12 6 6-6 12-6 6 6 12 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.35" />
      </svg>
      <h2>长图会出现在这里</h2>
      <p>在左侧添加图片，选择拼接方向，再下载 PNG。所有处理都在浏览器本地完成。</p>
    </div>
  </div>
);

const PrivacyIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
    <path d="M5.5 7V5.25a2.5 2.5 0 0 1 5 0V7" stroke="currentColor" strokeWidth="1.2" />
  </svg>
);

const imagesSignature = (images) => images
  .map((image) => `${image.id}:${JSON.stringify(normalizeTransform(image.transform))}`)
  .join('|');

const restoreImageFile = (record) => {
  const file = new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.lastModified
  });
  return {
    id: record.id,
    file,
    url: URL.createObjectURL(file),
    transform: record.transform
  };
};

function App() {
  const [history, setHistory] = useState(() => createHistory({ images: [], settings: DEFAULT_SETTINGS }));
  const { images, settings } = history.present;
  const imagesRef = useRef(images);
  const settingsRef = useRef(settings);
  const urlsRef = useRef(new Set());
  const themeTimerRef = useRef(null);
  const suppressSaveRef = useRef(false);
  const sessionEpochRef = useRef(0);
  const savedImagesSignatureRef = useRef(null);
  const savedSettingsSignatureRef = useRef(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [theme, setTheme] = useState(getInitialTheme);
  const [selectedId, setSelectedId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(() => (
    isSessionStorageAvailable() ? 'loading' : 'unavailable'
  ));
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-color')?.setAttribute('content', THEME_COLORS[theme]);
  }, [theme]);

  // Until the visitor makes an explicit choice, follow the OS preference.
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      if (!localStorage.getItem('theme')) setTheme(event.matches ? 'dark' : 'light');
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Restore the local session once (images + settings).
  useEffect(() => {
    let cancelled = false;
    const restoredUrls = [];

    (async () => {
      const session = await loadSession();
      if (cancelled) {
        restoredUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      if (!session) {
        setSessionStatus(isSessionStorageAvailable() ? 'idle' : 'unavailable');
        setSessionReady(true);
        return;
      }

      const restoredImages = (session.images || []).map((record) => {
        const restored = restoreImageFile(record);
        restoredUrls.push(restored.url);
        urlsRef.current.add(restored.url);
        return restored;
      });
      const restoredSettings = session.settings || DEFAULT_SETTINGS;

      imagesRef.current = restoredImages;
      settingsRef.current = restoredSettings;
      savedImagesSignatureRef.current = imagesSignature(restoredImages);
      savedSettingsSignatureRef.current = JSON.stringify(restoredSettings);
      setHistory(resetHistory({ images: restoredImages, settings: restoredSettings }));
      setSessionStatus('saved');
      setSessionReady(true);
    })().catch(() => {
      if (!cancelled) {
        setSessionStatus(isSessionStorageAvailable() ? 'idle' : 'unavailable');
        setSessionReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke Object URLs that no history snapshot can reach anymore.
  useEffect(() => {
    const referenced = new Set();
    historySnapshots(history).forEach((snapshot) => {
      snapshot.images.forEach((image) => referenced.add(image.url));
    });
    for (const url of urlsRef.current) {
      if (!referenced.has(url)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(url);
      }
    }
  }, [history]);

  useEffect(() => () => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    if (themeTimerRef.current) window.clearTimeout(themeTimerRef.current);
  }, []);

  // Persist images and settings separately, each with its own debounce.
  useEffect(() => {
    if (!sessionReady || suppressSaveRef.current) return undefined;
    const signature = imagesSignature(images);
    if (signature === savedImagesSignatureRef.current) return undefined;
    const epoch = sessionEpochRef.current;

    const timer = window.setTimeout(async () => {
      if (suppressSaveRef.current || epoch !== sessionEpochRef.current) return;
      setSessionStatus((previous) => (previous === 'unavailable' ? previous : 'saving'));
      const saved = await saveSessionImages(images);
      if (suppressSaveRef.current || epoch !== sessionEpochRef.current) {
        await clearSession();
        return;
      }
      if (saved) savedImagesSignatureRef.current = signature;
      setSessionStatus((previous) => {
        if (previous === 'unavailable') return previous;
        return saved ? 'saved' : 'error';
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [images, sessionReady]);

  useEffect(() => {
    if (!sessionReady || suppressSaveRef.current) return undefined;
    const signature = JSON.stringify(settings);
    if (signature === savedSettingsSignatureRef.current) return undefined;
    const epoch = sessionEpochRef.current;

    const timer = window.setTimeout(async () => {
      if (suppressSaveRef.current || epoch !== sessionEpochRef.current) return;
      setSessionStatus((previous) => (previous === 'unavailable' ? previous : 'saving'));
      const saved = await saveSessionSettings(settings);
      if (suppressSaveRef.current || epoch !== sessionEpochRef.current) {
        await clearSession();
        return;
      }
      if (saved) savedSettingsSignatureRef.current = signature;
      setSessionStatus((previous) => {
        if (previous === 'unavailable') return previous;
        return saved ? 'saved' : 'error';
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [settings, sessionReady]);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-switching');
    localStorage.setItem('theme', theme === 'light' ? 'dark' : 'light');
    setTheme((previousTheme) => (previousTheme === 'light' ? 'dark' : 'light'));
    if (themeTimerRef.current) window.clearTimeout(themeTimerRef.current);
    themeTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-switching');
    }, 200);
  };

  const markSaving = useCallback(() => {
    if (suppressSaveRef.current) return;
    setSessionStatus((previous) => (previous === 'unavailable' ? previous : 'saving'));
  }, []);

  const commit = useCallback((next, options) => {
    imagesRef.current = next.images;
    settingsRef.current = next.settings;
    markSaving();
    setHistory((previous) => pushHistory(previous, next, options));
  }, [markSaving]);

  const handleImagesUpload = useCallback((files) => {
    const result = addImageFiles(imagesRef.current, files);
    result.addedImages.forEach((image) => urlsRef.current.add(image.url));

    if (result.addedImages.length > 0) {
      commit({ images: ensureImageTransforms(result.images), settings: settingsRef.current });
    }

    const messages = [];
    if (result.rejected.nonImage > 0) messages.push(`${result.rejected.nonImage} 个非图片文件未添加`);
    if (result.rejected.tooLarge > 0) messages.push(`${result.rejected.tooLarge} 张图片超过 ${MAX_FILE_BYTES / (1024 * 1024)} MiB，已忽略`);
    if (result.rejected.overLimit > 0) messages.push(`最多保留 ${MAX_IMAGE_COUNT} 张图片，已忽略 ${result.rejected.overLimit} 张`);
    setUploadMessage(messages.join('；'));
  }, [commit]);

  const handleRemoveImage = useCallback((id) => {
    const nextImages = removeImage(imagesRef.current, id, () => {});
    if (nextImages.length === imagesRef.current.length) return;
    commit({ images: nextImages, settings: settingsRef.current });
    setSelectedId((current) => (current === id ? null : current));
    setUploadMessage('');
  }, [commit]);

  const handleReset = useCallback(() => {
    commit({ images: [], settings: settingsRef.current });
    setSelectedId(null);
    setUploadMessage('');
  }, [commit]);

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = imagesRef.current.findIndex((item) => item.id === active.id);
    const newIndex = imagesRef.current.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextImages = arrayMove(imagesRef.current, oldIndex, newIndex);
    commit({ images: nextImages, settings: settingsRef.current });
  }, [commit]);

  const handleSettingsChange = useCallback((updater) => {
    markSaving();
    setHistory((previous) => {
      const nextSettings = updater(previous.present.settings);
      return pushHistory(
        previous,
        { images: previous.present.images, settings: nextSettings },
        { coalesceKey: 'settings' }
      );
    });
  }, [markSaving]);

  const handleResetSettings = useCallback(() => {
    setHistory((previous) => pushHistory(previous, {
      images: previous.present.images,
      settings: DEFAULT_SETTINGS
    }));
  }, []);

  const handleUpdateTransform = useCallback((id, patch) => {
    const nextImages = withImageTransform(imagesRef.current, id, patch);
    commit({ images: nextImages, settings: settingsRef.current });
  }, [commit]);

  const handleClearSession = useCallback(async () => {
    suppressSaveRef.current = true;
    sessionEpochRef.current += 1;
    savedImagesSignatureRef.current = null;
    savedSettingsSignatureRef.current = null;
    const cleared = await clearSession();
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    urlsRef.current.clear();
    imagesRef.current = [];
    settingsRef.current = DEFAULT_SETTINGS;
    setHistory(resetHistory({ images: [], settings: DEFAULT_SETTINGS }));
    setSelectedId(null);
    setUploadMessage('');
    setSessionStatus(cleared ? 'cleared' : 'error');
    window.setTimeout(() => {
      suppressSaveRef.current = false;
    }, 1200);
  }, []);

  const activeSelectedId = images.some((image) => image.id === selectedId) ? selectedId : null;

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;
      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        markSaving();
        setHistory((previous) => (event.shiftKey ? redoHistory(previous) : undoHistory(previous)));
        return;
      }

      if (!meta && (event.key === 'Delete' || event.key === 'Backspace') && activeSelectedId) {
        event.preventDefault();
        handleRemoveImage(activeSelectedId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSelectedId, handleRemoveImage, markSaving]);

  useEffect(() => {
    const handlePaste = (event) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (files.length > 0) handleImagesUpload(files);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleImagesUpload]);

  const isFull = images.length >= MAX_IMAGE_COUNT;

  return (
    <div className="app-shell">
      <aside className="rail" aria-labelledby="app-title">
        <header className="rail-header">
          <div className="brand">
            <BrandMark />
            <div className="brand__text">
              <h1 id="app-title">图片拼接助手</h1>
              <p>多张图片，拼成一张长图。</p>
            </div>
          </div>
          <ThemeSwitcher theme={theme} toggleTheme={toggleTheme} />
        </header>

        <div className="rail-stack">
          <ImageUploader
            onImagesUpload={handleImagesUpload}
            count={images.length}
            max={MAX_IMAGE_COUNT}
            compact={images.length > 0}
            isFull={isFull}
          />
          <p className="visually-hidden" role="status" aria-live="polite">
            {uploadMessage}
          </p>
          {uploadMessage && (
            <p className="notice" aria-hidden="true">
              <span className="notice__dot" aria-hidden="true" />
              {uploadMessage}
            </p>
          )}
          {images.length > 0 && (
            <ImagePreview
              images={images}
              max={MAX_IMAGE_COUNT}
              direction={settings.direction}
              gridPreset={settings.gridPreset || 'auto'}
              selectedId={activeSelectedId}
              onSelectImage={setSelectedId}
              onUpdateTransform={handleUpdateTransform}
              onRemoveImage={handleRemoveImage}
              onDragEnd={handleDragEnd}
              onReset={handleReset}
            />
          )}
        </div>
      </aside>

      <main className="stage-column" aria-label="拼接结果">
        {images.length > 0 ? (
          <StitchCanvas
            images={images}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onResetSettings={handleResetSettings}
            sessionStatus={sessionStatus}
            onClearSession={handleClearSession}
          />
        ) : (
          <EmptyStage />
        )}
      </main>

      <footer className="app-footer">
        <p className="footer-privacy">
          <PrivacyIcon />
          图片只在本地处理，不会上传
        </p>
        <p className="footer-credit">
          Made by{' '}
          <a href="https://yishan.li" target="_blank" rel="noopener noreferrer">Yishan</a>
          <span aria-hidden="true"> · </span>MIT
          {images.length === 0 && sessionStatus === 'saved' && (
            <>
              <span aria-hidden="true"> · </span>
              <button type="button" className="footer-clear" onClick={handleClearSession}>
                清除本机数据
              </button>
            </>
          )}
        </p>
      </footer>
    </div>
  );
}

export default App;
