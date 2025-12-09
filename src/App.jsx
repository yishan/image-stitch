import { useState, useEffect, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import './App.css'
import ImageUploader from './components/ImageUploader'
import ImagePreview from './components/ImagePreview'
import StitchCanvas from './components/StitchCanvas'
import ThemeSwitcher from './components/ThemeSwitcher'

function App() {
  const [images, setImages] = useState([]);
  const [settings, setSettings] = useState({
    direction: 'horizontal', // 'horizontal' | 'vertical'
    gap: 20,
    backgroundColor: 'rgba(0, 0, 0, 0)',
    scale: 1
  });

  // Theme state
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const handleImagesUpload = useCallback((newFiles) => {
    if (images.length + newFiles.length > 6) {
      alert('You can only upload up to 6 images.');
      // Optionally slice the array to fit 6
      const remainingSlots = 6 - images.length;
      if (remainingSlots <= 0) return;
      newFiles = newFiles.slice(0, remainingSlots);
    }

    const newImages = newFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      url: URL.createObjectURL(file)
    }));

    setImages(prev => [...prev, ...newImages]);
  }, [images]);

  const handleRemoveImage = (id) => {
    setImages(prev => {
      const newImages = prev.filter(img => img.id !== id);
      // Revoke URL to avoid memory leaks
      const removedImage = prev.find(img => img.id === id);
      if (removedImage) {
        URL.revokeObjectURL(removedImage.url);
      }
      return newImages;
    });
  };

  const handleReset = () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    setImages([]);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Global paste handler
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.files) {
        const files = Array.from(e.clipboardData.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        if (imageFiles.length > 0) {
          handleImagesUpload(imageFiles);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handleImagesUpload]);

  return (
    <div className="app-container">
      <div className="app-content">
        <div className="left-panel">
          <header className="app-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1>图片拼接助手</h1>
                <p>将多张图片无缝拼接成一张长图。</p>
              </div>
              <ThemeSwitcher theme={theme} toggleTheme={toggleTheme} />
            </div>
          </header>

          <div className="input-section">
            <ImageUploader onImagesUpload={handleImagesUpload} />

            {images.length > 0 && (
              <>


                <ImagePreview
                  images={images}
                  onRemoveImage={handleRemoveImage}
                  onDragEnd={handleDragEnd}
                  onReset={handleReset}
                />
              </>
            )}
          </div>
          <footer className="app-footer">
            <p>Made by Saan Studio with Gemini 3</p>
          </footer>
        </div>

        <div className="right-panel">
          {images.length > 0 ? (
            <StitchCanvas
              images={images}
              settings={settings}
              onSettingsChange={setSettings}
            />
          ) : (
            <div className="empty-state">
              <p>上传图片以在此处预览</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
