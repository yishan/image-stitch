import { useRef, useState } from 'react';
import './ImageUploader.css';

const ImageUploader = ({ onImagesUpload }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    const processFiles = (files) => {
        if (files.length > 0) onImagesUpload(files);
    };

    const handleDragEnter = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
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
        processFiles(Array.from(event.dataTransfer.files));
    };

    const handleFileInput = (event) => {
        processFiles(Array.from(event.target.files));
        event.target.value = '';
    };

    return (
        <div
            className={`uploader-container ${isDragging ? 'dragging' : ''}`}
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
                className="uploader-input"
                aria-label="上传图片，最多 6 张"
                aria-describedby="upload-instructions"
            />
            <div className="uploader-content">
                <div className="icon-wrapper">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                </div>
                <h2>上传图片</h2>
                <p id="upload-instructions">拖拽最多 6 张图片到此处，或点击选择</p>
                <span className="sub-text">支持粘贴图片 (Ctrl+V)</span>
            </div>
        </div>
    );
};

export default ImageUploader;
