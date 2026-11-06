import React, { useState } from 'react';
import {
  Palette,
  Sparkles,
  Download,
  Loader2,
  Layers,
  RotateCcw,
  RotateCw
} from 'lucide-react';
import { PhotoInfo, JobResponse, AppSettings } from '../types';
import { PhotoUploader } from '../components/PhotoUploader';
import { replaceBackground, rotatePhoto, pollJob } from '../services/api';

interface BackgroundStudioProps {
  settings: AppSettings | null;
  photos: PhotoInfo[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoInfo[]>>;
  onAddToSheet?: (photo: PhotoInfo) => void;
  onJobFinished?: () => void;
}

export const BackgroundStudio: React.FC<BackgroundStudioProps> = ({
  settings,
  photos,
  setPhotos,
  onAddToSheet,
  onJobFinished,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string>(settings?.default_bg_color || '#0080FF');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeJob, setActiveJob] = useState<JobResponse | null>(null);
  const [processedPhoto, setProcessedPhoto] = useState<PhotoInfo | null>(null);

  const selectedPhoto = photos[selectedPhotoIndex] || null;

  const colorPresets = [
    { label: 'PJK Passport Blue', hex: '#0080FF' },
    { label: 'Royal Navy', hex: '#003366' },
    { label: 'Studio White', hex: '#FFFFFF' },
    { label: 'Off-White', hex: '#F4F6F9' },
    { label: 'Light Neutral Gray', hex: '#E2E8F0' },
    { label: 'Crimson Red', hex: '#B22222' },
  ];

  const handleRotate = async (angle: number) => {
    if (!selectedPhoto) return;
    try {
      const updated = await rotatePhoto(selectedPhoto.photo_id, angle);
      setPhotos((prev) =>
        prev.map((p, i) => (i === selectedPhotoIndex ? updated : p))
      );
    } catch (err: any) {
      alert(`Rotate failed: ${err.message}`);
    }
  };

  const handleReplaceBg = async () => {
    if (!selectedPhoto) return;
    try {
      setIsProcessing(true);
      setActiveJob(null);

      const initJob = await replaceBackground(selectedPhoto.photo_id, selectedColor);
      setActiveJob(initJob);

      const finalJob = await pollJob(initJob.job_id, (updated) => {
        setActiveJob(updated);
      });

      if (finalJob.status === 'completed' && finalJob.output_photo_id) {
        const outInfo: PhotoInfo = {
          photo_id: finalJob.output_photo_id,
          filename: `bg_${finalJob.output_photo_id.slice(0, 8)}.jpg`,
          original_name: `BgReplaced_${selectedPhoto.original_name}`,
          width: selectedPhoto.width,
          height: selectedPhoto.height,
          url: finalJob.preview_url || `/api/photos/${finalJob.output_photo_id}/view`,
          thumbnail_url: finalJob.preview_url || `/api/photos/${finalJob.output_photo_id}/view`,
          size_bytes: 0,
        };
        setProcessedPhoto(outInfo);
        if (onJobFinished) onJobFinished();
      } else {
        alert(finalJob.error || 'Background replacement failed');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Background Replacement Studio</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
              Local AI Segmentation
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Preserve face, fine hair edges & skin tone while replacing the background with custom solid colors.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PhotoUploader
            onPhotosUploaded={(newPhotos) => {
              setPhotos((prev) => [...prev, ...newPhotos]);
              setSelectedPhotoIndex(photos.length);
            }}
            compact
          />
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs max-w-xl mx-auto my-8">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-800">Upload Photograph for Background Change</h2>
            <p className="text-xs text-slate-500 mt-1">Select or drop a photo to begin.</p>
          </div>
          <PhotoUploader
            onPhotosUploaded={(newPhotos) => {
              setPhotos(newPhotos);
              setSelectedPhotoIndex(0);
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Photo selector & Color Picker (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Color Controls */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5 mb-3">
                  <Palette className="w-4 h-4 text-cyan-600" />
                  <span>Choose Background Color</span>
                </label>

                {/* Preset Pills */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {colorPresets.map((preset) => {
                    const isSelected = selectedColor.toUpperCase() === preset.hex.toUpperCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        onClick={() => setSelectedColor(preset.hex)}
                        className={`flex items-center space-x-2.5 p-2 rounded-xl border text-xs font-bold transition-all ${
                          isSelected
                            ? 'border-cyan-600 bg-cyan-50/70 text-cyan-900 shadow-2xs ring-2 ring-cyan-500/20'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs shrink-0"
                          style={{ backgroundColor: preset.hex }}
                        />
                        <span className="truncate">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom HEX / Color Picker */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value.toUpperCase())}
                    className="w-10 h-10 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white"
                  />
                  <div className="flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Hex Color
                    </span>
                    <input
                      type="text"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value.toUpperCase())}
                      maxLength={7}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-800 uppercase"
                      placeholder="#0080FF"
                    />
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl border border-slate-300 shadow-inner shrink-0"
                    style={{ backgroundColor: selectedColor }}
                    title="Live Color Swatch"
                  />
                </div>
              </div>

              {/* Replace Button */}
              <button
                type="button"
                onClick={handleReplaceBg}
                disabled={isProcessing || !selectedPhoto}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-extrabold text-sm shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Replacing Background...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>Apply Solid Background</span>
                  </>
                )}
              </button>

              {activeJob && (
                <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-xl text-xs text-cyan-800 font-medium flex items-center space-x-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600 shrink-0" />
                  <span>{activeJob.message}</span>
                </div>
              )}
            </div>

            {/* Thumbnail Strip */}
            {photos.length > 1 && (
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Photos in Studio ({photos.length})
                </span>
                <div className="flex space-x-2 overflow-x-auto pb-1">
                  {photos.map((p, idx) => (
                    <div
                      key={p.photo_id}
                      onClick={() => {
                        setSelectedPhotoIndex(idx);
                        setProcessedPhoto(null);
                      }}
                      className={`relative w-14 h-18 shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedPhotoIndex === idx
                          ? 'border-cyan-600 ring-2 ring-cyan-500/30 scale-102'
                          : 'border-slate-200 hover:border-slate-400 opacity-80'
                      }`}
                    >
                      <img
                        src={p.thumbnail_url}
                        alt="Thumb"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Previews Side by Side (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-slate-900 tracking-tight">
                    {processedPhoto ? 'Background Replacement Result' : 'Original Photograph'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    High-quality local human matting without cloud upload.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleRotate(-90)}
                    disabled={isProcessing}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                    title="Rotate 90° CCW"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRotate(90)}
                    disabled={isProcessing}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                    title="Rotate 90° CW"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {processedPhoto && (
                    <>
                      {onAddToSheet && (
                        <button
                          onClick={() => onAddToSheet(processedPhoto)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Add to 4×6 Sheet</span>
                        </button>
                      )}
                      <a
                        href={`/api/photos/${processedPhoto.photo_id}/download`}
                        download
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition-colors shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download JPEG</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Side-by-Side Comparison Container */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Before */}
                <div className="space-y-1.5 text-center">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">
                    Original Background
                  </span>
                  <div className="w-full aspect-3/4 max-h-[380px] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center shadow-inner">
                    {selectedPhoto && (
                      <img
                        src={selectedPhoto.url}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                </div>

                {/* After */}
                <div className="space-y-1.5 text-center">
                  <span className="text-[11px] font-bold text-cyan-700 uppercase">
                    New Background ({selectedColor})
                  </span>
                  <div
                    className="w-full aspect-3/4 max-h-[380px] rounded-2xl overflow-hidden border-2 border-cyan-500 flex items-center justify-center shadow-md relative"
                    style={{ backgroundColor: selectedColor }}
                  >
                    {processedPhoto ? (
                      <img
                        src={processedPhoto.url}
                        alt="Processed"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <Palette className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-slate-500">
                          Click "Apply Solid Background"
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Output will render here with fine edge blending.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
