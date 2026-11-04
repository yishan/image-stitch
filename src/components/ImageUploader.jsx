import { useRef, useState } from 'react';
import './ImageUploader.css';

const isApplePlatform = () => {
  const source = navigator.platform || navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/i.test(source);
};

const UploadIcon = () => (
  <svg className="uploader-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
    <path d="M12 15.5V4.5m0 0L7.75 8.75M12 4.5l4.25 4.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 15.5v2.75A1.75 1.75 0 0 0 6.25 20h11.5a1.75 1.75 0 0 0 1.75-1.75V15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
    <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ImageUploader = ({ onImagesUpload, count = 0, max = 6, compact = false, isFull = false }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const processFiles = (files) => {
        if (files.length > 0) onImagesUpload(files);
    };

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isFull) setIsDragging(true);
    };

    const handleDragLeave = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (!isFull) processFiles(Array.from(event.dataTransfer.files));
    };

    const handleFileInput = (event) => {
        processFiles(Array.from(event.target.files));
        event.target.value = '';
    };

    const pasteShortcut = isApplePlatform() ? '⌘V' : 'Ctrl+V';

    return (
        <div
            className={[
                'uploader',
                compact ? 'uploader--compact' : 'uploader--empty',
                isDragging ? 'is-dragging' : '',
                isFull ? 'is-full' : ''
            ].filter(Boolean).join(' ')}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
        >
            <input
                id="image-upload-input"
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                onClick={(event) => event.stopPropagation()}
                multiple
                accept="image/*"
                disabled={isFull}
                className="uploader-input"
                aria-label={compact ? `继续添加图片，目前 ${count} 张，最多 ${max} 张` : `添加图片，最多 ${max} 张`}
                aria-describedby={compact ? undefined : 'upload-instructions'}
            />

            {compact ? (
                <div className="uploader-row">
                    <PlusIcon />
                    <span className="uploader-row__label">{isFull ? '已达上限' : '继续添加图片'}</span>
                    <span className="uploader-row__count mono" aria-hidden="true">{count} / {max}</span>
                </div>
            ) : (
                <div className="uploader-content">
                    <UploadIcon />
                    <p className="uploader-title">添加图片</p>
                    <p id="upload-instructions" className="uploader-hint">
                        拖拽图片到这里，或点击选择（最多 {max} 张）
                    </p>
                    <p className="uploader-paste">
                        也可以直接粘贴 <kbd>{pasteShortcut}</kbd>
                    </p>
                </div>
            )}
        </div>
    );
};

export default ImageUploader;
