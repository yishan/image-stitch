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
  releaseImageUrls,
  removeImage
} from './lib/imageIntake';
import { DEFAULT_EXPORT_SETTINGS } from './lib/stitchRenderer.js';

const THEME_COLORS = {
  light: '#f6f3ed',
  dark: '#13110f'
};

const DEFAULT_SETTINGS = {
  direction: 'vertical',
  showWave: true,
  backgroundColor: 'transparent',
  gap: 0,
  margin: 0,
  radius: 0,
  seamStrength: 'regular',
  export: { ...DEFAULT_EXPORT_SETTINGS }
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

function App() {
  const [images, setImages] = useState([]);
  const imagesRef = useRef([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [uploadMessage, setUploadMessage] = useState('');
  const [theme, setTheme] = useState(getInitialTheme);
  const themeTimerRef = useRef(null);

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

  useEffect(() => () => {
    releaseImageUrls(imagesRef.current);
    if (themeTimerRef.current) window.clearTimeout(themeTimerRef.current);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-switching');
    localStorage.setItem('theme', theme === 'light' ? 'dark' : 'light');
    setTheme((previousTheme) => (previousTheme === 'light' ? 'dark' : 'light'));
    if (themeTimerRef.current) window.clearTimeout(themeTimerRef.current);
    themeTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-switching');
    }, 200);
  };

  const handleImagesUpload = useCallback((files) => {
    const result = addImageFiles(imagesRef.current, files);
    imagesRef.current = result.images;
    setImages(result.images);

    const messages = [];
    if (result.rejected.nonImage > 0) messages.push(`${result.rejected.nonImage} 个非图片文件未添加`);
    if (result.rejected.tooLarge > 0) messages.push(`${result.rejected.tooLarge} 张图片超过 ${MAX_FILE_BYTES / (1024 * 1024)} MiB，已忽略`);
    if (result.rejected.overLimit > 0) messages.push(`最多保留 ${MAX_IMAGE_COUNT} 张图片，已忽略 ${result.rejected.overLimit} 张`);
    setUploadMessage(messages.join('；'));
  }, []);

  const handleRemoveImage = useCallback((id) => {
    const nextImages = removeImage(imagesRef.current, id);
    imagesRef.current = nextImages;
    setImages(nextImages);
    setUploadMessage('');
  }, []);

  const handleReset = useCallback(() => {
    releaseImageUrls(imagesRef.current);
    imagesRef.current = [];
    setImages([]);
    setUploadMessage('');
  }, []);

  const handleDragEnd = useCallback(({ active, over }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = imagesRef.current.findIndex((item) => item.id === active.id);
    const newIndex = imagesRef.current.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextImages = arrayMove(imagesRef.current, oldIndex, newIndex);
    imagesRef.current = nextImages;
    setImages(nextImages);
  }, []);

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
              onRemoveImage={handleRemoveImage}
              onDragEnd={handleDragEnd}
              onReset={handleReset}
            />
          )}
        </div>
      </aside>

      <main className="stage-column" aria-label="拼接结果">
        {images.length > 0 ? (
          <StitchCanvas images={images} settings={settings} onSettingsChange={setSettings} />
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
        </p>
      </footer>
    </div>
  );
}

export default App;
