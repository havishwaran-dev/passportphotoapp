import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Download,
  Loader2,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Palette,
  Type,
  Layout,
  Sliders,
  CheckCircle2,
  PartyPopper,
  Crown
} from 'lucide-react';
import { PhotoInfo, JobResponse, AppSettings, CollagePresetsResponse } from '../types';
import { PhotoUploader } from '../components/PhotoUploader';
import { fetchCollagePresets, generateCollage, pollJob } from '../services/api';

interface CollageStudioProps {
  settings: AppSettings | null;
  photos: PhotoInfo[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoInfo[]>>;
  onJobFinished?: () => void;
}

export const CollageStudio: React.FC<CollageStudioProps> = ({
  photos,
  setPhotos,
  onJobFinished,
}) => {
  // Presets from backend
  const [presets, setPresets] = useState<CollagePresetsResponse | null>(null);

  // Selected photo IDs in specific order
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>(() => {
    return photos.slice(0, 6).map((p) => p.photo_id);
  });

  // Customization Form State
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [templateId, setTemplateId] = useState<string>('hero_celebration');
  const [themeId, setThemeId] = useState<string>('gold_luxury');
  const [customBgColor, setCustomBgColor] = useState<string>('');
  const [title, setTitle] = useState<string>('HAPPY BIRTHDAY');
  const [name, setName] = useState<string>('CELEBRANT');
  const [subtitle, setSubtitle] = useState<string>('Wishing you joy, love & happiness on your special day!');
  const [fontFamily, setFontFamily] = useState<string>('georgia');
  const [fontSizeScale, setFontSizeScale] = useState<number>(1.0);
  const [showDecorations, setShowDecorations] = useState<boolean>(true);
  const [roundedCorners, setRoundedCorners] = useState<boolean>(true);

  // Processing state
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<JobResponse | null>(null);
  const [generatedCollageId, setGeneratedCollageId] = useState<string | null>(null);
  const [generatedCollageUrl, setGeneratedCollageUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchCollagePresets()
      .then(setPresets)
      .catch((err) => console.error('Failed to load presets:', err));
  }, []);

  // Sync selected photo IDs if photos changed and none selected
  useEffect(() => {
    if (selectedPhotoIds.length === 0 && photos.length > 0) {
      setSelectedPhotoIds(photos.slice(0, Math.min(6, photos.length)).map((p) => p.photo_id));
    }
  }, [photos]);

  const selectedPhotos = useMemo(() => {
    const map = new Map(photos.map((p) => [p.photo_id, p]));
    return selectedPhotoIds.map((id) => map.get(id)).filter(Boolean) as PhotoInfo[];
  }, [selectedPhotoIds, photos]);

  const handleTogglePhoto = (photoId: string) => {
    if (selectedPhotoIds.includes(photoId)) {
      if (selectedPhotoIds.length <= 2) {
        alert('A collage requires at least 2 photographs.');
        return;
      }
      setSelectedPhotoIds((prev) => prev.filter((id) => id !== photoId));
    } else {
      if (selectedPhotoIds.length >= 20) {
        alert('Maximum 20 photographs allowed per collage poster.');
        return;
      }
      setSelectedPhotoIds((prev) => [...prev, photoId]);
    }
  };

  const handleMovePhoto = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= selectedPhotoIds.length) return;
    const next = [...selectedPhotoIds];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setSelectedPhotoIds(next);
  };

  const handleSetHero = (index: number) => {
    if (index === 0) return;
    const next = [...selectedPhotoIds];
    const item = next.splice(index, 1)[0];
    next.unshift(item);
    setSelectedPhotoIds(next);
  };

  const handleSelectAll = () => {
    const ids = photos.slice(0, 20).map((p) => p.photo_id);
    setSelectedPhotoIds(ids);
  };

  const handleGenerate = async () => {
    if (selectedPhotoIds.length < 2) {
      alert('Please select at least 2 photographs for the collage.');
      return;
    }

    try {
      setIsGenerating(true);
      setActiveJob(null);
      setGeneratedCollageUrl(null);

      const payload = {
        photos: selectedPhotoIds,
        orientation,
        template_id: templateId,
        theme_id: themeId,
        custom_bg_color: customBgColor || undefined,
        title,
        name,
        subtitle,
        font_family: fontFamily,
        font_size_scale: fontSizeScale,
        show_decorations: showDecorations,
        rounded_corners: roundedCorners,
        border_width: 8
      };

      const initJob = await generateCollage(payload);
      setActiveJob(initJob);

      const finalJob = await pollJob(initJob.job_id, (updated) => {
        setActiveJob(updated);
      });

      if (finalJob.status === 'completed' && finalJob.collage_id) {
        setGeneratedCollageId(finalJob.collage_id);
        setGeneratedCollageUrl(finalJob.preview_url || `/api/collage/${finalJob.collage_id}/view`);
        if (onJobFinished) onJobFinished();
      } else {
        alert(finalJob.error || 'Collage generation failed');
      }
    } catch (err: any) {
      alert(`Error generating collage: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>Birthday Photo Collage Studio</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center space-x-1">
              <PartyPopper className="w-3.5 h-3.5" />
              <span>A4 Print Size @ 300 DPI</span>
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-arrange 2 to 20 photographs into a celebration poster with custom fonts and themes.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PhotoUploader
            onPhotosUploaded={(newPhotos) => {
              setPhotos((prev) => [...prev, ...newPhotos]);
              setSelectedPhotoIds((prev) => [
                ...prev,
                ...newPhotos.map((p) => p.photo_id).filter((id) => !prev.includes(id))
              ].slice(0, 20));
            }}
            compact
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Customization Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Step 1: Photos Selection & Ordering */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Layout className="w-3.5 h-3.5 text-rose-600" />
                <span>Selected Photos ({selectedPhotoIds.length} / 20)</span>
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800"
                >
                  Select All
                </button>
              </div>
            </div>

            {/* Selected items tray with reordering */}
            {selectedPhotos.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedPhotos.map((photo, idx) => (
                  <div
                    key={photo.photo_id}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all text-xs"
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="relative w-10 h-12 shrink-0 rounded-lg overflow-hidden border border-slate-300">
                        <img
                          src={photo.thumbnail_url}
                          alt="Thumb"
                          className="w-full h-full object-cover object-top"
                        />
                        {idx === 0 && templateId === 'hero_celebration' && (
                          <div className="absolute top-0 right-0 bg-amber-500 text-white p-0.5 rounded-bl">
                            <Crown className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-slate-800 flex items-center space-x-1">
                          <span>#{idx + 1}</span>
                          {idx === 0 && templateId === 'hero_celebration' && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                              Hero Photo
                            </span>
                          )}
                        </span>
                        <p className="text-[11px] text-slate-500 truncate">{photo.original_name}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      {idx !== 0 && templateId === 'hero_celebration' && (
                        <button
                          type="button"
                          onClick={() => handleSetHero(idx)}
                          className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold"
                          title="Make this the spotlight hero photo"
                        >
                          Set Hero
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(idx, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePhoto(idx, 'down')}
                        disabled={idx === selectedPhotoIds.length - 1}
                        className="p-1 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePhoto(photo.photo_id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                No photographs selected. Click photos from the library below.
              </p>
            )}

            {/* Photo Library Grid to Add More */}
            {photos.length > selectedPhotoIds.length && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Add from Studio Tray:
                </span>
                <div className="flex space-x-2 overflow-x-auto pb-1">
                  {photos
                    .filter((p) => !selectedPhotoIds.includes(p.photo_id))
                    .map((p) => (
                      <div
                        key={p.photo_id}
                        onClick={() => handleTogglePhoto(p.photo_id)}
                        className="relative w-12 h-16 shrink-0 rounded-lg overflow-hidden cursor-pointer border border-slate-300 hover:border-rose-500 group"
                        title={`Click to add ${p.original_name}`}
                      >
                        <img src={p.thumbnail_url} alt="Photo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-rose-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Template Selection */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Sliders className="w-3.5 h-3.5 text-rose-600" />
              <span>Collage Template Style</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  id: 'hero_celebration',
                  name: 'Hero Spotlight',
                  desc: '1 large primary + supporting',
                  icon: Crown,
                  badge: 'Popular'
                },
                {
                  id: 'balanced_mosaic',
                  name: 'Balanced Mosaic',
                  desc: 'Even symmetrical grid',
                  icon: Layout,
                  badge: 'Classic'
                },
                {
                  id: 'polaroid',
                  name: 'Polaroid Cards',
                  desc: 'Soft shadowed cards',
                  icon: Sparkles,
                  badge: 'Retro'
                }
              ].map((tmpl) => {
                const Icon = tmpl.icon;
                const isSel = templateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setTemplateId(tmpl.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSel
                        ? 'border-rose-600 bg-rose-50/70 ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Icon className={`w-4 h-4 ${isSel ? 'text-rose-600' : 'text-slate-500'}`} />
                      <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-rose-100 text-rose-800">
                        {tmpl.badge}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 block">{tmpl.name}</span>
                    <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">{tmpl.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 3: Greeting Typography */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Type className="w-3.5 h-3.5 text-rose-600" />
              <span>Typography &amp; Birthday Greeting</span>
            </label>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                  Header Greeting
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="HAPPY BIRTHDAY"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                    Celebrant Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="PRIYA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-rose-700"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                    Font Family
                  </label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="georgia">Georgia (Elegant Serif)</option>
                    <option value="arial">Arial (Modern Bold)</option>
                    <option value="times">Times (Royal Serif)</option>
                    <option value="segoeui">Segoe UI (Clean Fluent)</option>
                    <option value="comic">Comic Sans (Kids Party)</option>
                    <option value="impact">Impact (Bold Headline)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">
                  Subtitle / Wish Message
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Wishing you joy, love & happiness on your special day!"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center space-x-3 pt-1">
                <label className="text-[11px] font-semibold text-slate-600">Font Scale:</label>
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={fontSizeScale}
                  onChange={(e) => setFontSizeScale(parseFloat(e.target.value))}
                  className="w-32 accent-rose-600 cursor-pointer"
                />
                <span className="text-[11px] font-mono text-slate-700">{fontSizeScale}x</span>
              </div>
            </div>
          </div>

          {/* Step 4: Theme & Poster Style */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Palette className="w-3.5 h-3.5 text-rose-600" />
              <span>Theme &amp; Canvas Options</span>
            </label>

            {/* Theme Swatches */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gold_luxury', name: 'Royal Gold', bg: '#0F172A', accent: '#F59E0B' },
                { id: 'midnight_blue', name: 'Midnight Blue', bg: '#0A192F', accent: '#38BDF8' },
                { id: 'white', name: 'Studio White', bg: '#FFFFFF', accent: '#2563EB' },
                { id: 'pastel_pink', name: 'Pastel Rose', bg: '#FFF1F2', accent: '#E11D48' },
                { id: 'sky_celebration', name: 'Sky Party', bg: '#F0F9FF', accent: '#0284C7' },
                { id: 'festive_party', name: 'Festive Carnival', bg: '#FEF2F2', accent: '#DC2626' },
              ].map((th) => {
                const isSel = themeId === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setThemeId(th.id)}
                    className={`flex items-center space-x-2 p-2 rounded-xl border text-xs font-bold transition-all ${
                      isSel
                        ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-xs ring-1 ring-rose-500/30'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                      style={{ backgroundColor: th.bg }}
                    />
                    <span className="truncate">{th.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                  Sheet Orientation
                </label>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="portrait">A4 Portrait (2480×3508)</option>
                  <option value="landscape">A4 Landscape (3508×2480)</option>
                </select>
              </div>

              <div className="space-y-1 pt-1">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showDecorations}
                    onChange={(e) => setShowDecorations(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
                  />
                  <span>Party Confetti</span>
                </label>

                <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roundedCorners}
                    onChange={(e) => setRoundedCorners(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600 accent-rose-600 cursor-pointer"
                  />
                  <span>Rounded Photo Corners</span>
                </label>
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || selectedPhotoIds.length < 2}
              className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white font-black text-sm shadow-md shadow-rose-500/20 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{activeJob?.message || 'Generating A4 Birthday Poster...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>Generate A4 Birthday Poster (300 DPI)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Live Design Canvas & Output Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-900 tracking-tight">
                  {generatedCollageUrl ? 'Generated A4 Birthday Poster' : 'Real-Time Layout Preview'}
                </h2>
                <p className="text-xs text-slate-500">
                  {orientation === 'portrait' ? 'A4 Portrait (2480 × 3508 px)' : 'A4 Landscape (3508 × 2480 px)'} @ 300 DPI
                </p>
              </div>

              {generatedCollageId && (
                <a
                  href={`/api/collage/${generatedCollageId}/download`}
                  download={`birthday_poster_${generatedCollageId.slice(0, 8)}.jpg`}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download High-Res A4 JPEG</span>
                </a>
              )}
            </div>

            {/* Poster Canvas Frame */}
            <div className="w-full flex justify-center bg-slate-900/5 p-4 rounded-2xl border border-slate-200/80 overflow-hidden">
              {generatedCollageUrl ? (
                <div className="relative max-h-[640px] shadow-2xl rounded-lg overflow-hidden border border-slate-300">
                  <img
                    src={generatedCollageUrl}
                    alt="A4 Birthday Poster"
                    className="max-h-[640px] w-auto object-contain"
                  />
                  <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-md flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>300 DPI Print Ready</span>
                  </div>
                </div>
              ) : (
                /* Simulated Layout Preview */
                <div
                  className={`w-full ${
                    orientation === 'portrait' ? 'aspect-7/10 max-w-[440px]' : 'aspect-10/7 max-w-[580px]'
                  } rounded-xl p-4 shadow-xl border flex flex-col justify-between transition-all duration-300 relative overflow-hidden`}
                  style={{
                    backgroundColor:
                      themeId === 'gold_luxury'
                        ? '#0F172A'
                        : themeId === 'midnight_blue'
                        ? '#0A192F'
                        : themeId === 'pastel_pink'
                        ? '#FFF1F2'
                        : themeId === 'sky_celebration'
                        ? '#F0F9FF'
                        : themeId === 'festive_party'
                        ? '#FEF2F2'
                        : '#FFFFFF',
                    color:
                      themeId === 'gold_luxury' || themeId === 'midnight_blue' ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  {/* Decorative Outer Border */}
                  <div className="absolute inset-2 border-2 border-amber-500/40 pointer-events-none rounded-lg" />
                  <div className="absolute inset-3 border border-amber-500/20 pointer-events-none rounded-md" />

                  {/* Header Typography */}
                  <div className="text-center pt-2 pb-1 space-y-0.5 z-10">
                    <span
                      className="text-xs font-black tracking-widest block uppercase"
                      style={{
                        color:
                          themeId === 'gold_luxury'
                            ? '#F59E0B'
                            : themeId === 'midnight_blue'
                            ? '#38BDF8'
                            : themeId === 'pastel_pink'
                            ? '#E11D48'
                            : '#2563EB',
                        fontFamily: fontFamily === 'comic' ? 'Comic Sans MS, cursive' : fontFamily === 'georgia' ? 'Georgia, serif' : 'sans-serif'
                      }}
                    >
                      {title}
                    </span>
                    <h3
                      className="text-2xl font-black tracking-tight"
                      style={{
                        color:
                          themeId === 'gold_luxury'
                            ? '#FCD34D'
                            : themeId === 'midnight_blue'
                            ? '#FFFFFF'
                            : themeId === 'pastel_pink'
                            ? '#BE123C'
                            : '#1E3A8A',
                        fontFamily: fontFamily === 'comic' ? 'Comic Sans MS, cursive' : fontFamily === 'georgia' ? 'Georgia, serif' : 'sans-serif'
                      }}
                    >
                      {name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[90%] mx-auto">
                      {subtitle}
                    </p>
                    <div className="w-32 h-0.5 bg-amber-500/40 mx-auto my-1" />
                  </div>

                  {/* Photo Slots Grid Preview */}
                  <div className="flex-1 my-1 grid gap-1.5 p-1 z-10 overflow-hidden"
                    style={{
                      gridTemplateColumns:
                        templateId === 'hero_celebration'
                          ? selectedPhotos.length <= 4
                            ? '1.2fr 1fr'
                            : selectedPhotos.length <= 8
                            ? 'repeat(3, 1fr)'
                            : 'repeat(4, 1fr)'
                          : selectedPhotos.length <= 4
                          ? 'repeat(2, 1fr)'
                          : selectedPhotos.length <= 9
                          ? 'repeat(3, 1fr)'
                          : 'repeat(4, 1fr)'
                    }}
                  >
                    {selectedPhotos.map((photo, i) => {
                      const isHero = i === 0 && templateId === 'hero_celebration';
                      return (
                        <div
                          key={photo.photo_id}
                          className={`relative rounded-lg overflow-hidden border shadow-xs bg-slate-200 ${
                            isHero ? 'col-span-2 row-span-2 border-amber-400' : 'border-white/80'
                          }`}
                        >
                          <img
                            src={photo.thumbnail_url}
                            alt="Slot"
                            className="w-full h-full object-cover object-top"
                          />
                          {isHero && (
                            <div className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow">
                              SPOTLIGHT HERO
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer Stamp */}
                  <div className="text-center pb-1 text-[9px] text-slate-400 font-medium z-10">
                    Designed with Love • PJK Xerox Studio Print Output
                  </div>
                </div>
              )}
            </div>

            {/* Print Shop Guidelines Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 block">
                Printing Shop Operator Notes:
              </span>
              <p>
                • Output files are rendered at <strong>exact 300 DPI A4 dimensions</strong> (2480 × 3508 pixels).
              </p>
              <p>
                • Load standard <strong>A4 Glossy / Matte Photo Paper</strong> (210 × 297 mm) into your shop printer.
              </p>
              <p>
                • Fits all standard A4 photo frames or laminating sheets without distortion.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

