import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Minus,
  Trash2,
  Download,
  Loader2,
  Sparkles,
  Scissors
} from 'lucide-react';
import { PhotoInfo, AppSettings, JobResponse } from '../types';
import { generateSheet, pollJob } from '../services/api';
import { PhotoUploader } from '../components/PhotoUploader';

interface SheetStudioProps {
  settings: AppSettings | null;
  photos: PhotoInfo[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoInfo[]>>;
  initialSelectedPhotos?: { photo_id: string; copies: number }[];
  onJobFinished?: () => void;
}

interface SelectedItem {
  photo: PhotoInfo;
  copies: number;
}

export const SheetStudio: React.FC<SheetStudioProps> = ({
  settings,
  photos,
  setPhotos,
  onJobFinished,
}) => {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [spacingMm, setSpacingMm] = useState<number>(settings?.sheet_spacing_mm || 3.0);
  const [marginMm, setMarginMm] = useState<number>(settings?.sheet_margin_mm || 4.0);
  const [cuttingGuides, setCuttingGuides] = useState<boolean>(true);

  // Selected items with copy counts
  const [sheetItems, setSheetItems] = useState<SelectedItem[]>(() => {
    if (photos.length > 0) {
      // Default to 8 copies of first photo if landscape, or 4 each if 2 photos
      if (photos.length === 1) {
        return [{ photo: photos[0], copies: 8 }];
      } else {
        return [
          { photo: photos[0], copies: 4 },
          { photo: photos[1], copies: 4 },
        ];
      }
    }
    return [];
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<JobResponse | null>(null);
  const [generatedSheetUrl, setGeneratedSheetUrl] = useState<string | null>(null);
  const [generatedSheetId, setGeneratedSheetId] = useState<string | null>(null);

  // Capacity calculation
  // 35x45mm at 300 DPI = 413 x 531 px
  // Landscape: 1800 x 1200 px -> 4 cols x 2 rows = 8 photos max
  // Portrait: 1200 x 1800 px -> 2 cols x 3-4 rows = 6-8 photos max
  const maxSlots = useMemo(() => {
    return orientation === 'landscape' ? 8 : 6;
  }, [orientation]);

  const totalCopies = useMemo(() => {
    return sheetItems.reduce((acc, item) => acc + item.copies, 0);
  }, [sheetItems]);

  const handleAddPhotoToSheet = (photo: PhotoInfo) => {
    setSheetItems((prev) => {
      const existing = prev.find((item) => item.photo.photo_id === photo.photo_id);
      if (existing) {
        return prev.map((item) =>
          item.photo.photo_id === photo.photo_id
            ? { ...item, copies: item.copies + 1 }
            : item
        );
      }
      return [...prev, { photo, copies: 1 }];
    });
  };

  const handleUpdateCopies = (photoId: string, delta: number) => {
    setSheetItems((prev) =>
      prev
        .map((item) => {
          if (item.photo.photo_id === photoId) {
            const nextCopies = Math.max(1, item.copies + delta);
            return { ...item, copies: nextCopies };
          }
          return item;
        })
        .filter((item) => item.copies > 0)
    );
  };

  const handleRemoveItem = (photoId: string) => {
    setSheetItems((prev) => prev.filter((item) => item.photo.photo_id !== photoId));
  };

  const handleAutoFillRemaining = (photoId: string) => {
    const currentOthers = sheetItems
      .filter((item) => item.photo.photo_id !== photoId)
      .reduce((acc, i) => acc + i.copies, 0);
    const target = Math.max(1, maxSlots - currentOthers);
    setSheetItems((prev) =>
      prev.map((item) =>
        item.photo.photo_id === photoId ? { ...item, copies: target } : item
      )
    );
  };

  const handleGenerateSheet = async () => {
    if (sheetItems.length === 0) return;

    try {
      setIsGenerating(true);
      setActiveJob(null);
      setGeneratedSheetUrl(null);

      const payload = sheetItems.map((item) => ({
        photo_id: item.photo.photo_id,
        copies: item.copies,
      }));

      const initJob = await generateSheet(
        payload,
        orientation,
        spacingMm,
        marginMm,
        cuttingGuides,
        '#FFFFFF'
      );
      setActiveJob(initJob);

      const finalJob = await pollJob(initJob.job_id, (updated) => {
        setActiveJob(updated);
      });

      if (finalJob.status === 'completed' && finalJob.sheet_id) {
        setGeneratedSheetId(finalJob.sheet_id);
        setGeneratedSheetUrl(finalJob.preview_url || `/api/sheets/${finalJob.sheet_id}/view`);
        if (onJobFinished) onJobFinished();
      } else {
        alert(finalJob.error || 'Failed to generate 4×6 sheet');
      }
    } catch (err: any) {
      alert(`Sheet generation error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Build the list of photos for the preview grid
  const previewSlots = useMemo(() => {
    const list: PhotoInfo[] = [];
    for (const item of sheetItems) {
      for (let i = 0; i < item.copies; i++) {
        if (list.length < maxSlots) {
          list.push(item.photo);
        }
      }
    }
    return list;
  }, [sheetItems, maxSlots]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>4×6 Inch Photo Sheet Studio</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              1200×1800 px @ 300 DPI
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Arrange multiple passport photos onto a single 4×6 inch sheet for printing shop output.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PhotoUploader
            onPhotosUploaded={(newPhotos) => {
              setPhotos((prev) => [...prev, ...newPhotos]);
              if (sheetItems.length === 0 && newPhotos.length > 0) {
                setSheetItems([{ photo: newPhotos[0], copies: maxSlots }]);
              }
            }}
            compact
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Controls & Photo Items (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Sheet Options Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Sheet Configuration</span>
            </h2>

            {/* Orientation Toggle */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1.5">
                Sheet Orientation
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    orientation === 'landscape'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Landscape (6×4 in) — 8 Photos
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    orientation === 'portrait'
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-xs'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Portrait (4×6 in) — 6 Photos
                </button>
              </div>
            </div>

            {/* Spacing & Margin Sliders */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-semibold text-slate-700 flex justify-between">
                  <span>Photo Spacing</span>
                  <span className="text-slate-500 font-mono">{spacingMm} mm</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="6"
                  step="0.5"
                  value={spacingMm}
                  onChange={(e) => setSpacingMm(parseFloat(e.target.value))}
                  className="w-full mt-1.5 accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 flex justify-between">
                  <span>Outer Margin</span>
                  <span className="text-slate-500 font-mono">{marginMm} mm</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  step="0.5"
                  value={marginMm}
                  onChange={(e) => setMarginMm(parseFloat(e.target.value))}
                  className="w-full mt-1.5 accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Cutting Guides Checkbox */}
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center space-x-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cuttingGuides}
                  onChange={(e) => setCuttingGuides(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <Scissors className="w-3.5 h-3.5 text-slate-500" />
                <span>Add Cutting Crop Marks (for Scissors / Trimmer)</span>
              </label>
            </div>
          </div>

          {/* Photos On This Sheet */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Photos Arranged ({totalCopies}/{maxSlots})
              </span>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  totalCopies === maxSlots
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : totalCopies > maxSlots
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}
              >
                {totalCopies === maxSlots
                  ? 'Sheet Full'
                  : totalCopies > maxSlots
                  ? `${totalCopies - maxSlots} overflow`
                  : `${maxSlots - totalCopies} slots available`}
              </span>
            </div>

            {sheetItems.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed rounded-2xl">
                No photos added yet. Select from available photos below.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {sheetItems.map((item) => (
                  <div
                    key={item.photo.photo_id}
                    className="flex items-center space-x-3 p-2.5 rounded-2xl border border-slate-200 bg-slate-50/70"
                  >
                    <img
                      src={item.photo.thumbnail_url}
                      alt="Thumbnail"
                      className="w-12 h-14 object-cover rounded-xl border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {item.photo.original_name}
                      </p>
                      <button
                        onClick={() => handleAutoFillRemaining(item.photo.photo_id)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        Auto-fill to {maxSlots}
                      </button>
                    </div>

                    {/* Copy Stepper */}
                    <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => handleUpdateCopies(item.photo.photo_id, -1)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold font-mono text-slate-800">
                        {item.copies}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateCopies(item.photo.photo_id, 1)}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.photo.photo_id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove from sheet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Generate Button */}
            <button
              type="button"
              onClick={handleGenerateSheet}
              disabled={isGenerating || sheetItems.length === 0}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{activeJob?.message || 'Generating 4×6 Print Sheet...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  <span>Generate Complete 4×6 Sheet</span>
                </>
              )}
            </button>
          </div>

          {/* Available Photos Gallery */}
          {photos.length > 0 && (
            <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Available Photos in Studio ({photos.length})
              </span>
              <div className="flex space-x-2 overflow-x-auto pb-1">
                {photos.map((p) => {
                  const alreadyAdded = sheetItems.some(
                    (item) => item.photo.photo_id === p.photo_id
                  );
                  return (
                    <div
                      key={p.photo_id}
                      onClick={() => handleAddPhotoToSheet(p)}
                      className={`relative w-14 h-18 shrink-0 rounded-xl overflow-hidden cursor-pointer border ${
                        alreadyAdded ? 'border-indigo-400 ring-2 ring-indigo-200' : 'border-slate-200'
                      } hover:border-indigo-500 hover:scale-105 transition-all group`}
                      title={`Click to add ${p.original_name}`}
                    >
                      <img
                        src={p.thumbnail_url}
                        alt="Photo"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-indigo-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sheet Preview & Output (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">
                  {generatedSheetUrl ? 'Generated 4×6 Photo Sheet' : 'Live Sheet Preview'}
                </h2>
                <p className="text-xs text-slate-500">
                  {orientation === 'landscape' ? '6×4 inch (1800×1200 px)' : '4×6 inch (1200×1800 px)'} @ 300 DPI
                </p>
              </div>

              {generatedSheetId && (
                <a
                  href={`/api/sheets/${generatedSheetId}/download`}
                  download
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Print JPEG</span>
                </a>
              )}
            </div>

            {/* The Sheet Canvas Container */}
            <div className="w-full flex items-center justify-center bg-slate-100 p-4 rounded-2xl border border-slate-200/80 shadow-inner min-h-[420px]">
              {generatedSheetUrl ? (
                /* Show the actual generated high-res image */
                <div className="relative shadow-xl rounded-lg overflow-hidden border border-slate-300 max-w-full">
                  <img
                    src={generatedSheetUrl}
                    alt="4x6 Sheet Output"
                    className="max-h-[500px] w-auto object-contain bg-white"
                  />
                </div>
              ) : (
                /* Live Interactive Grid Preview */
                <div
                  className={`bg-white shadow-xl rounded-lg p-3 border border-slate-300 transition-all ${
                    orientation === 'landscape'
                      ? 'w-[480px] aspect-3/2'
                      : 'w-[320px] aspect-2/3'
                  } flex flex-col justify-center items-center relative overflow-hidden`}
                >
                  {/* Grid */}
                  <div
                    className={`grid gap-2 w-full h-full p-2 items-center justify-center ${
                      orientation === 'landscape' ? 'grid-cols-4' : 'grid-cols-2'
                    }`}
                  >
                    {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                      const photo = previewSlots[slotIdx];
                      return (
                        <div
                          key={slotIdx}
                          className="w-full aspect-35/45 rounded border border-slate-200 overflow-hidden flex items-center justify-center relative bg-slate-50 group shadow-2xs"
                        >
                          {photo ? (
                            <img
                              src={photo.thumbnail_url}
                              alt="Slot Photo"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-[10px] font-mono text-slate-300 flex flex-col items-center">
                              <span>Slot {slotIdx + 1}</span>
                              <span className="text-[9px]">35×45mm</span>
                            </div>
                          )}

                          {cuttingGuides && (
                            <div className="absolute inset-0 pointer-events-none border border-slate-400/40 border-dashed" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Sheet Footer Details */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <div className="flex items-center space-x-3">
                <span>Standard Photo Sheet: 4×6 in</span>
                <span>•</span>
                <span>Print Density: 300 DPI</span>
                <span>•</span>
                <span>Photo: 35×45 mm</span>
              </div>
              <div className="font-semibold text-slate-700">
                PJK Xerox Production Ready
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
