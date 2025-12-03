import { useState, useEffect, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import './App.css'
import ImageUploader from './components/ImageUploader'
import ImagePreview from './components/ImagePreview'
import StitchCanvas from './components/StitchCanvas'

function App() {
  const [images, setImages] = useState([]);
  const [settings, setSettings] = useState({
    direction: 'horizontal', // 'horizontal' | 'vertical'
    gap: 20,
    backgroundColor: '#ffffff',
    scale: 1
  });

  const handleImagesUpload = useCallback((newFiles) => {
    if (images.length + newFiles.length > 5) {
      alert('You can only upload up to 5 images.');
      // Optionally slice the array to fit 5
      const remainingSlots = 5 - images.length;
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
            <h1>Image Stitcher</h1>
            <p>Stitch multiple images into one seamless image.</p>
          </header>

          <div className="input-section">
            <ImageUploader onImagesUpload={handleImagesUpload} />

            {images.length > 0 && (
              <>
                <div className="settings-panel">
                  <div className="setting-group">
                    <label>Direction:</label>
                    <div className="toggle-group">
                      <button
                        className={settings.direction === 'horizontal' ? 'active' : ''}
                        onClick={() => setSettings(s => ({ ...s, direction: 'horizontal' }))}
                      >
                        Horizontal
                      </button>
                      <button
                        className={settings.direction === 'vertical' ? 'active' : ''}
                        onClick={() => setSettings(s => ({ ...s, direction: 'vertical' }))}
                      >
                        Vertical
                      </button>
                    </div>
                  </div>
                </div>

                <ImagePreview
                  images={images}
                  onRemoveImage={handleRemoveImage}
                  onDragEnd={handleDragEnd}
                />
              </>
            )}
          </div>
        </div>

        <div className="right-panel">
          {images.length > 0 ? (
            <StitchCanvas images={images} settings={settings} />
          ) : (
            <div className="empty-state">
              <p>Upload images to see the preview here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
