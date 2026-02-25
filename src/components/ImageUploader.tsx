// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Image, X, Loader2 } from 'lucide-react';
import './ImageUploader.css';

interface ImageUploaderProps {
  onImageAnalyzed: (description: string) => void;
  onAnalyzing: (analyzing: boolean) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  analyzeImage: (base64: string, mimeType: string) => Promise<{ description: string }>;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageAnalyzed,
  onAnalyzing,
  onError,
  disabled = false,
  analyzeImage
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    // Validate file type
    if (!SUPPORTED_TYPES.includes(file.type)) {
      onError(`Unsupported file type. Please upload: ${SUPPORTED_TYPES.map(t => t.split('/')[1]).join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      onError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      return;
    }

    setFileName(file.name);

    // Create preview
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      setPreviewUrl(result);

      // Extract base64 data (remove the data:image/...;base64, prefix)
      const base64Data = result.split(',')[1];
      
      setIsAnalyzing(true);
      onAnalyzing(true);

      try {
        const { description } = await analyzeImage(base64Data, file.type);
        onImageAnalyzed(description);
      } catch (err: any) {
        onError(err.message || 'Failed to analyze the image. Please try again.');
        clearImage();
      } finally {
        setIsAnalyzing(false);
        onAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  }, [analyzeImage, onImageAnalyzed, onAnalyzing, onError]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [disabled, processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const clearImage = () => {
    setPreviewUrl(null);
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && !isAnalyzing && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="image-uploader">
      <div className="image-uploader-header">
        <Image size={16} />
        <span>Upload Architecture Diagram</span>
        <span className="optional-badge">Optional</span>
      </div>
      
      <div
        className={`image-drop-zone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''} ${previewUrl ? 'has-image' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={SUPPORTED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="file-input"
          disabled={disabled || isAnalyzing}
        />
        
        {isAnalyzing ? (
          <div className="analyzing-state">
            <Loader2 size={32} className="spinner" />
            <p>Analyzing diagram with AI...</p>
            <span className="analyzing-hint">Extracting services, connections, and data flows</span>
          </div>
        ) : previewUrl ? (
          <div className="preview-container">
            <img src={previewUrl} alt="Uploaded diagram" className="preview-image" />
            <div className="preview-overlay">
              <span className="file-name">{fileName}</span>
              <button 
                className="clear-button" 
                onClick={(e) => { e.stopPropagation(); clearImage(); }}
                title="Remove image"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div className="upload-prompt">
            <Upload size={28} className="upload-icon" />
            <p>Drop an architecture diagram here or click to browse</p>
            <span className="upload-hint">PNG, JPG, GIF, WebP up to 20MB</span>
          </div>
        )}
      </div>
      
      {previewUrl && !isAnalyzing && (
        <p className="image-success-hint">
          ✓ Image analyzed! The description has been added to the prompt below. Review and generate when ready.
        </p>
      )}
    </div>
  );
};

export default ImageUploader;
