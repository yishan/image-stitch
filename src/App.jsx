import { useState, useEffect, useCallback, useRef } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import './App.css';
import ImageUploader from './components/ImageUploader';
import ImagePreview from './components/ImagePreview';
import StitchCanvas from './components/StitchCanvas';
import ThemeSwitcher from './components/ThemeSwitcher';
import { addImageFiles, MAX_FILE_BYTES, releaseImageUrls, removeImage } from './lib/imageIntake';

function App() {
  const [images, setImages] = useState([]);
  const imagesRef = useRef([]);
  const [settings, setSettings] = useState({
    direction: 'vertical',
    showWave: true,
    backgroundColor: 'rgba(0, 0, 0, 0)'
  });
  const [uploadMessage, setUploadMessage] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => () => releaseImageUrls(imagesRef.current), []);

  const toggleTheme = () => {
    setTheme((previousTheme) => (previousTheme === 'light' ? 'dark' : 'light'));
  };

  const handleImagesUpload = useCallback((files) => {
    const result = addImageFiles(imagesRef.current, files);
    imagesRef.current = result.images;
    setImages(result.images);

    const messages = [];
    if (result.rejected.nonImage > 0) messages.push(`${result.rejected.nonImage} 个非图片文件未添加`);
    if (result.rejected.tooLarge > 0) messages.push(`${result.rejected.tooLarge} 张图片超过 ${MAX_FILE_BYTES / (1024 * 1024)} MiB，已忽略`);
    if (result.rejected.overLimit > 0) messages.push(`最多保留 6 张图片，已忽略 ${result.rejected.overLimit} 张`);
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

  return (
    <div className="app-container">
      <main className="app-content">
        <section className="left-panel" aria-labelledby="app-title">
          <header className="app-header">
            <div className="header-row">
              <div>
                <h1 id="app-title">图片拼接助手</h1>
                <p>将多张图片无缝拼接成一张长图。</p>
              </div>
              <ThemeSwitcher theme={theme} toggleTheme={toggleTheme} />
            </div>
          </header>

          <div className="input-section">
            <ImageUploader onImagesUpload={handleImagesUpload} />
            {uploadMessage && <p className="upload-message" role="status">{uploadMessage}</p>}
            {images.length > 0 && (
              <ImagePreview
                images={images}
                onRemoveImage={handleRemoveImage}
                onDragEnd={handleDragEnd}
                onReset={handleReset}
              />
            )}
          </div>

          <footer className="app-footer">
            <p>Made by <a href="https://yishan.li" target="_blank" rel="noopener noreferrer">Yishan</a> with Gemini 3</p>
          </footer>
        </section>

        <section className="right-panel" aria-label="拼接结果">
          {images.length > 0 ? (
            <StitchCanvas images={images} settings={settings} onSettingsChange={setSettings} />
          ) : (
            <div className="empty-state"><p>上传图片以在此处预览</p></div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
