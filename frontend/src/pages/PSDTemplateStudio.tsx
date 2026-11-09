import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  X,
  Image as ImageIcon,
  Type,
  FileImage,
  ChevronLeft,
  ChevronRight,
  Sliders,
  FolderOpen
} from 'lucide-react';
import {
  PhotoInfo,
  TemplateCategory,
  TemplateSummary,
  TemplateDetail,
  JobResponse,
  AppSettings
} from '../types';
import { PhotoUploader } from '../components/PhotoUploader';
import {
  fetchTemplateCategories,
  fetchTemplates,
  fetchTemplateDetails,
  generateTemplate,
  pollJob
} from '../services/api';

interface PSDTemplateStudioProps {
  settings: AppSettings | null;
  photos: PhotoInfo[];
  setPhotos: React.Dispatch<React.SetStateAction<PhotoInfo[]>>;
  onJobFinished?: () => void;
}

export const PSDTemplateStudio: React.FC<PSDTemplateStudioProps> = ({
  photos,
  setPhotos,
  onJobFinished
}) => {
  // Catalog State
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const limit = 24;
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);

  // Active Customization State
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateSummary | null>(null);
  const [templateDetails, setTemplateDetails] = useState<TemplateDetail | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  // Form State
  const [photoAssignments, setPhotoAssignments] = useState<Record<string, string>>({});
  const [textAssignments, setTextAssignments] = useState<Record<string, string>>({});

  // Processing State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeJob, setActiveJob] = useState<JobResponse | null>(null);
  const [generatedOutputUrl, setGeneratedOutputUrl] = useState<string | null>(null);
  const [generatedDownloadUrl, setGeneratedDownloadUrl] = useState<string | null>(null);

  // Load categories on mount
  useEffect(() => {
    fetchTemplateCategories()
      .then(setCategories)
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Load templates when category, search, or page changes
  useEffect(() => {
    setIsLoadingList(true);
    fetchTemplates(selectedCategory, searchQuery, limit, page * limit)
      .then((res) => {
        setTemplates(res.templates);
        setTotalCount(res.total);
      })
      .catch((err) => console.error('Failed to load templates:', err))
      .finally(() => setIsLoadingList(false));
  }, [selectedCategory, searchQuery, page]);

  // Load deep details when a template is selected
  const handleSelectTemplate = async (tmpl: TemplateSummary) => {
    setSelectedTemplate(tmpl);
    setIsLoadingDetails(true);
    setGeneratedOutputUrl(null);
    setGeneratedDownloadUrl(null);
    setActiveJob(null);

    try {
      const details = await fetchTemplateDetails(tmpl.template_id);
      setTemplateDetails(details);

      // Initialize text fields with their original text
      const initialTexts: Record<string, string> = {};
      details.text_slots.forEach((ts) => {
        initialTexts[ts.layer_name] = ts.original_text;
      });
      setTextAssignments(initialTexts);

      // Pre-assign available customer photos to slots
      const initialPhotos: Record<string, string> = {};
      details.photo_slots.forEach((ps, idx) => {
        if (photos[idx]) {
          initialPhotos[ps.layer_name] = photos[idx].photo_id;
        }
      });
      setPhotoAssignments(initialPhotos);
    } catch (err: any) {
      alert(`Could not load template details: ${err.message}`);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate || !templateDetails) return;

    try {
      setIsGenerating(true);
      setActiveJob(null);
      setGeneratedOutputUrl(null);
      setGeneratedDownloadUrl(null);

      const payload = {
        template_id: selectedTemplate.template_id,
        photo_assignments: Object.entries(photoAssignments).map(([slot_name, photo_id]) => ({
          slot_name,
          photo_id
        })),
        text_assignments: Object.entries(textAssignments).map(([layer_name, text]) => ({
          layer_name,
          text
        })),
        engine: 'fast_studio',
        jpeg_quality: 95
      };

      const initJob = await generateTemplate(payload);
      setActiveJob(initJob);

      const finalJob = await pollJob(initJob.job_id, (updated) => {
        setActiveJob(updated);
      });

      if (finalJob.status === 'completed') {
        setGeneratedOutputUrl(finalJob.preview_url || null);
        setGeneratedDownloadUrl(finalJob.result_url || null);
        if (onJobFinished) onJobFinished();
      } else {
        alert(finalJob.error || 'Template generation failed');
      }
    } catch (err: any) {
      alert(`Error generating template output: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <span>PSD Template Automation Studio</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 flex items-center space-x-1">
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{totalCount} Templates in C:\photodesings</span>
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Auto-populate customer photos and replace names/dates in professional Photoshop design templates.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <PhotoUploader
            onPhotosUploaded={(newPhotos) => {
              setPhotos((prev) => [...prev, ...newPhotos]);
            }}
            compact
          />
        </div>
      </div>

      {/* Category Filter Pills & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search templates by title or category (e.g. 01, Birthday, Anniversary, Story)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setPage(0);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setPage(0);
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Templates ({totalCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.name);
                setPage(0);
              }}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat.name
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Template Gallery */}
      <div className="space-y-4">
        {isLoadingList ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold">Loading PSD templates from C:\photodesings...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-2">
            <FileImage className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No PSD templates found</h3>
            <p className="text-xs text-slate-400">Try adjusting your search query or selecting another category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {templates.map((tmpl) => (
              <div
                key={tmpl.template_id}
                onClick={() => handleSelectTemplate(tmpl)}
                className="group bg-white rounded-2xl border border-slate-200 hover:border-indigo-500/50 shadow-2xs hover:shadow-md transition-all overflow-hidden cursor-pointer flex flex-col"
              >
                {/* Thumbnail */}
                <div className="relative aspect-3/4 bg-slate-100 overflow-hidden">
                  <img
                    src={tmpl.preview_url}
                    alt={tmpl.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                    {tmpl.width}×{tmpl.height}
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-2.5 flex-1 flex flex-col justify-between space-y-1.5">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 truncate" title={tmpl.name}>
                      {tmpl.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate" title={tmpl.category}>
                      {tmpl.category}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      Customize
                    </span>
                    <span className="text-[10px] text-slate-400">300 DPI</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl p-3 border border-slate-200 text-xs">
            <span className="text-slate-500 font-semibold">
              Showing {page * limit + 1} - {Math.min((page + 1) * limit, totalCount)} of {totalCount} templates
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 font-bold flex items-center space-x-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <span className="font-mono text-slate-700 px-2 font-bold">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 font-bold flex items-center space-x-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Template Customization Modal / Drawer */}
      {selectedTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center space-x-2">
                  <span>Customize Template: {selectedTemplate.name}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">
                    {selectedTemplate.width} × {selectedTemplate.height} px @ 300 DPI
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{selectedTemplate.category}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Left Column: Template Preview / Result (5 cols) */}
              <div className="md:col-span-5 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                  {generatedOutputUrl ? 'Generated Print Output' : 'Template Artwork Preview'}
                </label>
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900/5 aspect-3/4 flex items-center justify-center relative">
                  <img
                    src={generatedOutputUrl || selectedTemplate.preview_url}
                    alt="Preview"
                    className="max-h-full max-w-full object-contain shadow"
                  />
                  {generatedOutputUrl && (
                    <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ready to Print</span>
                    </div>
                  )}
                </div>

                {generatedDownloadUrl && (
                  <a
                    href={generatedDownloadUrl}
                    download={`psd_print_${selectedTemplate.name}.jpg`}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Full 300 DPI JPEG</span>
                  </a>
                )}
              </div>

              {/* Right Column: Customization Controls (7 cols) */}
              <div className="md:col-span-7 space-y-5">
                {isLoadingDetails ? (
                  <div className="py-16 text-center space-y-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs">Inspecting PSD layers and photo slots...</p>
                  </div>
                ) : templateDetails ? (
                  <>
                    {/* Section 1: Customer Photo Placement */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Place Customer Photographs ({templateDetails.photo_slots.length} Slots)</span>
                      </label>

                      <div className="space-y-2">
                        {templateDetails.photo_slots.map((slot, sIdx) => {
                          const assignedPhotoId = photoAssignments[slot.layer_name];
                          const assignedPhoto = photos.find((p) => p.photo_id === assignedPhotoId);

                          return (
                            <div
                              key={slot.slot_id}
                              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-800">
                                  Slot #{sIdx + 1}: {slot.layer_name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {slot.width} × {slot.height} px
                                </span>
                              </div>

                              {/* Photo selector dropdown / chips */}
                              {photos.length === 0 ? (
                                <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded-lg">
                                  No customer photos uploaded yet. Use the upload button at the top to add photos!
                                </p>
                              ) : (
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                  {photos.map((p) => {
                                    const isSel = assignedPhotoId === p.photo_id;
                                    return (
                                      <button
                                        key={p.photo_id}
                                        type="button"
                                        onClick={() =>
                                          setPhotoAssignments((prev) => ({
                                            ...prev,
                                            [slot.layer_name]: p.photo_id
                                          }))
                                        }
                                        className={`w-10 h-12 rounded-lg overflow-hidden border shrink-0 transition-all ${
                                          isSel
                                            ? 'ring-2 ring-indigo-600 border-indigo-600 scale-105'
                                            : 'border-slate-300 opacity-60 hover:opacity-100'
                                        }`}
                                      >
                                        <img
                                          src={p.thumbnail_url}
                                          alt="thumb"
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Section 2: Editable Typography & Text Layers */}
                    {templateDetails.text_slots.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                          <Type className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Customize Text Layers ({templateDetails.text_slots.length} Fields)</span>
                        </label>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {templateDetails.text_slots.map((ts) => (
                            <div key={ts.layer_name} className="space-y-0.5">
                              <label className="text-[11px] font-bold text-slate-700 block">
                                {ts.layer_name}
                              </label>
                              <input
                                type="text"
                                value={textAssignments[ts.layer_name] ?? ts.original_text}
                                onChange={(e) =>
                                  setTextAssignments((prev) => ({
                                    ...prev,
                                    [ts.layer_name]: e.target.value
                                  }))
                                }
                                placeholder={ts.original_text}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Section 3: Action Button */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white font-black text-sm shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{activeJob?.message || 'Generating Print Poster...'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-amber-200" />
                            <span>Generate Ready-To-Print Poster (300 DPI)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
