import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadPhotos } from '../services/api';
import { PhotoInfo } from '../types';

interface PhotoUploaderProps {
  onPhotosUploaded: (photos: PhotoInfo[]) => void;
  compact?: boolean;
}

export const PhotoUploader: React.FC<PhotoUploaderProps> = ({
  onPhotosUploaded,
  compact = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (['image/jpeg', 'image/png', 'image/jpg'].includes(f.type) || f.name.match(/\.(jpe?g|png)$/i)) {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) {
      setError('Please select valid JPG or PNG photographs.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      const res = await uploadPhotos(validFiles);
      if (res.success && res.photos.length > 0) {
        onPhotosUploaded(res.photos);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  if (compact) {
    return (
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
          ) : (
            <Upload className="w-3.5 h-3.5 text-blue-600" />
          )}
          <span>{isUploading ? 'Uploading...' : 'Upload Photos'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
            : 'border-slate-300 hover:border-blue-400 bg-white hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs">
            {isUploading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800">
              {isUploading ? 'Uploading photographs...' : 'Click to upload or drag & drop'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Supports high-resolution JPG, JPEG, and PNG (Batch upload supported)
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-rose-600 font-medium bg-rose-50 border border-rose-200 p-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
};
