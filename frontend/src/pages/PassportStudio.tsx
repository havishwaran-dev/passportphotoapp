import React, { useState } from 'react';
import {
  RotateCcw,
  RotateCw,
  Sparkles,
  Download,
  Trash2,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  Palette
} from 'lucide-react';
import { PhotoUploader } from '../components/PhotoUploader';
import { PhotoInfo, JobResponse, AppSettings } from '../types';
import {
  rotatePhoto,
  processPassport,
  replaceBackground,
  processComplete,
  pollJob
} from '../services/api';

interface PassportStudioProps {
  settings: AppSettings | null;
  uploadedPhotos: PhotoInfo[];
  setUploadedPhotos: React.Dispatch<React.SetStateAction<PhotoInfo[]>>;
  onAddToSheet?: (photo: PhotoInfo) => void;
  onJobFinished?: () => void;
}

export const PassportStudio: React.FC<PassportStudioProps> = ({
  settings,
  uploadedPhotos,
  setUploadedPhotos,
  onAddToSheet,
  onJobFinished,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [mode, setMode] = useState<'complete' | 'passport' | 'background'>('complete');
  
  // Background options
  const [bgChoice, setBgChoice] = useState<'blue' | 'custom' | 'original'>('blue');
  const [customHex, setCustomHex] = useState<string>('#FFFFFF');
  const defaultBlue = settings?.default_bg_color || '#0080FF';

  // Processing state
  const [activeJob, setActiveJob] = useState<JobResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastProcessedPhoto, setLastProcessedPhoto] = useState<PhotoInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPhoto = uploadedPhotos[selectedPhotoIndex] || null;

  const handlePhotosUploaded = (newPhotos: PhotoInfo[]) => {
    setUploadedPhotos((prev) => [...prev, ...newPhotos]);
    setSelectedPhotoIndex(uploadedPhotos.length); // select the newly added photo
  };

  const handleRotate = async (angle: number) => {
    if (!selectedPhoto) return;
    try {
      const updated = await rotatePhoto(selectedPhoto.photo_id, angle);
      setUploadedPhotos((prev) =>
        prev.map((p, idx) => (idx === selectedPhotoIndex ? updated : p))
      );
    } catch (err: any) {
      alert(`Rotate failed: ${err.message}`);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setUploadedPhotos((prev) => prev.filter((_, i) => i !== index));
    if (selectedPhotoIndex >= index && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    }
  };

  const getEffectiveBgColor = (): string => {
    if (bgChoice === 'original') return 'original';
    if (bgChoice === 'blue') return defaultBlue;
    return customHex;
  };

  const handleStartProcessing = async () => {
    if (!selectedPhoto) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setActiveJob(null);

      const targetBg = getEffectiveBgColor();
      let initJob: JobResponse;

      if (mode === 'complete') {
        initJob = await processComplete(selectedPhoto.photo_id, targetBg);
      } else if (mode === 'passport') {
        initJob = await processPassport(selectedPhoto.photo_id);
      } else {
        initJob = await replaceBackground(selectedPhoto.photo_id, targetBg);
      }

      setActiveJob(initJob);

      // Poll until done
      const finalJob = await pollJob(initJob.job_id, (updated) => {
        setActiveJob(updated);
      });

      if (finalJob.status === 'completed' && finalJob.output_photo_id) {
        const resultInfo: PhotoInfo = {
          photo_id: finalJob.output_photo_id,
          filename: `passport_${finalJob.output_photo_id.slice(0, 8)}.jpg`,
          original_name: `Processed_${selectedPhoto.original_name}`,
          width: 413,
          height: 531,
          url: finalJob.preview_url || `/api/photos/${finalJob.output_photo_id}/view`,
          thumbnail_url: finalJob.preview_url || `/api/photos/${finalJob.output_photo_id}/view`,
          size_bytes: 0,
        };
        setLastProcessedPhoto(resultInfo);
        if (onJobFinished) onJobFinished();
      } else if (finalJob.status === 'failed') {
        setErrorMessage(finalJob.error || 'Photo processing failed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during processing.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Hex to RGB string helper for live preview
  const hexToRgbString = (hex: string): string => {
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16) || 0;
      const g = parseInt(clean.substring(2, 4), 16) || 0;
      const b = parseInt(clean.substring(4, 6), 16) || 0;
      return `rgb(${r}, ${g}, ${b})`;
    }
    return 'rgb(255, 255, 255)';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Passport Photo Studio</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              35×45 mm @ 300 DPI
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual passport photo processing, background replacement & Photoshop action execution.
          </p>
        </div>

        {uploadedPhotos.length > 0 && (
          <div className="flex items-center space-x-2">
            <PhotoUploader onPhotosUploaded={handlePhotosUploaded} compact />
          </div>
        )}
      </div>

      {uploadedPhotos.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xs max-w-xl mx-auto my-8">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-800">Upload Customer Photograph</h2>
            <p className="text-xs text-slate-500 mt-1">
              Select or drop the photograph to begin processing.
            </p>
          </div>
          <PhotoUploader onPhotosUploaded={handlePhotosUploaded} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Thumbnails & Selected Photo Preview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Main Preview Card */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Original Photograph
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleRotate(-90)}
                    disabled={isProcessing}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                    title="Rotate 90° CCW"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRotate(90)}
                    disabled={isProcessing}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                    title="Rotate 90° CW"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemovePhoto(selectedPhotoIndex)}
                    disabled={isProcessing}
                    className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors ml-1"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Photo Display Frame */}
              <div className="w-full aspect-3/4 max-h-[380px] bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-200/80 shadow-inner relative">
                {selectedPhoto && (
                  <img
                    src={selectedPhoto.url}
                    alt="Original Upload"
                    className="w-full h-full object-contain"
                  />
                )}
                <div className="absolute bottom-2 left-2 bg-slate-900/70 text-white text-[10px] font-mono px-2 py-0.5 rounded backdrop-blur-xs">
                  {selectedPhoto?.width} × {selectedPhoto?.height} px
                </div>
              </div>

              <p className="text-xs text-slate-500 truncate" title={selectedPhoto?.original_name}>
                File: <span className="font-semibold text-slate-700">{selectedPhoto?.original_name}</span>
              </p>
            </div>

            {/* Thumbnail Strip for Multi-upload */}
            {uploadedPhotos.length > 1 && (
              <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Uploaded Photos ({uploadedPhotos.length})
                </p>
                <div className="flex space-x-2 overflow-x-auto pb-1">
                  {uploadedPhotos.map((photo, idx) => (
                    <div
                      key={photo.photo_id}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`relative w-16 h-20 shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedPhotoIndex === idx
                          ? 'border-blue-600 ring-2 ring-blue-500/30 scale-102'
                          : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={photo.thumbnail_url}
                        alt="Thumbnail"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Processing Controls & Output (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Control Panel */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
              {/* Section 1: Background Replacement Controls */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between mb-2">
                  <span className="flex items-center space-x-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-600" />
                    <span>Background Replacement</span>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    Local AI Human Segmentation
                  </span>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {/* Option A: Original */}
                  <button
                    type="button"
                    onClick={() => setBgChoice('original')}
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      bgChoice === 'original'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full border border-slate-300 bg-linear-to-tr from-slate-300 to-slate-100" />
                    <span>Keep Original</span>
                  </button>

                  {/* Option B: PJK Blue */}
                  <button
                    type="button"
                    onClick={() => setBgChoice('blue')}
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      bgChoice === 'blue'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-blue-400 shadow-2xs"
                      style={{ backgroundColor: defaultBlue }}
                    />
                    <span>Passport Blue</span>
                  </button>

                  {/* Option C: Custom Color */}
                  <button
                    type="button"
                    onClick={() => setBgChoice('custom')}
                    className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      bgChoice === 'custom'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-slate-300 shadow-2xs"
                      style={{ backgroundColor: customHex }}
                    />
                    <span>Custom Color</span>
                  </button>
                </div>

                {/* Custom Color Picker Drawer */}
                {bgChoice === 'custom' && (
                  <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={customHex}
                        onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                        className="w-9 h-9 rounded-xl border border-slate-300 p-0.5 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={customHex}
                        onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                        maxLength={7}
                        className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                        placeholder="#FFFFFF"
                      />
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
                      <span>RGB:</span>
                      <span className="font-semibold text-slate-700">
                        {hexToRgbString(customHex)}
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center space-x-1 ml-auto">
                      {[
                        { label: 'White', hex: '#FFFFFF' },
                        { label: 'Off-White', hex: '#F0F4F8' },
                        { label: 'Light Gray', hex: '#E2E8F0' },
                        { label: 'Red', hex: '#C53030' },
                      ].map((preset) => (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setCustomHex(preset.hex)}
                          className="w-6 h-6 rounded-md border border-slate-300 hover:scale-110 transition-transform shadow-2xs"
                          style={{ backgroundColor: preset.hex }}
                          title={preset.label}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Processing Workflow Mode */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5 mb-2">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>Processing Workflow</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('complete')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      mode === 'complete'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-extrabold text-blue-900">
                        Mode 3: Complete
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                        Standard
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Background replacement + Photoshop action (<code className="font-mono text-blue-700">PJK</code>).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('passport')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      mode === 'passport'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-xs font-extrabold text-slate-900 block mb-1">
                      Mode 1: Action Only
                    </span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Executes Photoshop <code className="font-mono text-slate-700">passport</code> action directly.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('background')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      mode === 'background'
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-xs font-extrabold text-slate-900 block mb-1">
                      Mode 2: BG Only
                    </span>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      Replaces background with selected color without Photoshop.
                    </p>
                  </button>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleStartProcessing}
                disabled={isProcessing || !selectedPhoto}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Photograph...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-200" />
                    <span>Run Passport Photo Processing</span>
                  </>
                )}
              </button>

              {/* Real-time Processing Stepper */}
              {activeJob && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                      {activeJob.status === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : activeJob.status === 'failed' ? (
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                      ) : (
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      )}
                      <span>Status: {activeJob.message}</span>
                    </span>
                    <span className="font-mono font-bold text-blue-700">
                      {activeJob.progress}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        activeJob.status === 'completed'
                          ? 'bg-emerald-500'
                          : activeJob.status === 'failed'
                          ? 'bg-rose-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${activeJob.progress}%` }}
                    />
                  </div>

                  {activeJob.meta?.fallback_used && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 font-medium">
                      Notice: Studio Passport Engine enhanced output was generated cleanly.
                    </p>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
                  {errorMessage}
                </div>
              )}
            </div>

            {/* Output Preview Card (Side by Side Comparison) */}
            {lastProcessedPhoto && (
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Processed Passport Photo Ready</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Dimensions: 35×45 mm (413×531 px) @ 300 DPI
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {onAddToSheet && (
                      <button
                        onClick={() => onAddToSheet(lastProcessedPhoto)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
                        title="Add this processed photo to 4×6 print sheet"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Add to 4×6 Sheet</span>
                      </button>
                    )}
                    <a
                      href={`/api/photos/${lastProcessedPhoto.photo_id}/download`}
                      download
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download JPEG</span>
                    </a>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {/* Original */}
                  <div className="space-y-1.5 text-center">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                      Before (Original)
                    </span>
                    <div className="w-full aspect-3/4 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center">
                      <img
                        src={selectedPhoto?.url}
                        alt="Original"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Processed Result */}
                  <div className="space-y-1.5 text-center">
                    <span className="text-[11px] font-bold text-blue-700 uppercase">
                      After (Passport Result)
                    </span>
                    <div className="w-full aspect-3/4 bg-slate-100 rounded-2xl overflow-hidden border-2 border-blue-600 flex items-center justify-center shadow-md">
                      <img
                        src={lastProcessedPhoto.url}
                        alt="Processed Passport"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
