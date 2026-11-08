import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  Folder,
  Sliders,
  Sparkles,
  Info
} from 'lucide-react';
import { AppSettings, HealthResponse } from '../types';
import { saveSettings } from '../services/api';

interface SettingsPageProps {
  settings: AppSettings | null;
  onSettingsSaved: (updated: AppSettings) => void;
  health: HealthResponse | null;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onSettingsSaved,
  health,
}) => {
  const [form, setForm] = useState<AppSettings | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({ ...settings });
    }
  }, [settings]);

  if (!form) return <div className="p-8 text-slate-500">Loading settings...</div>;

  const handleChange = (key: keyof AppSettings, val: any) => {
    setForm((prev) => (prev ? { ...prev, [key]: val } : null));
    setSavedSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    try {
      setIsSaving(true);
      const updated = await saveSettings(form);
      onSettingsSaved(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoDetectPs = () => {
    if (health?.photoshop_path) {
      handleChange('photoshop_exe_path', health.photoshop_path);
    } else {
      handleChange(
        'photoshop_exe_path',
        'C:\\Program Files\\Adobe\\Adobe Photoshop CS6 (x64)\\Photoshop.exe'
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Studio Configuration &amp; Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Passport sizing, print resolution, Photoshop paths, and default preferences.
          </p>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>Saved Successfully!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </>
          )}
        </button>
      </div>

      {/* Grid of Setting Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Passport Photo Dimensions & DPI */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Passport Photo Specifications</span>
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Width (mm)
              </label>
              <input
                type="number"
                step="0.5"
                value={form.passport_width_mm}
                onChange={(e) => handleChange('passport_width_mm', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400">Default: 35 mm</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Height (mm)
              </label>
              <input
                type="number"
                step="0.5"
                value={form.passport_height_mm}
                onChange={(e) => handleChange('passport_height_mm', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400">Default: 45 mm</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Resolution (DPI)
              </label>
              <input
                type="number"
                value={form.dpi}
                onChange={(e) => handleChange('dpi', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400">Default: 300 DPI</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                JPEG Print Quality (1-100)
              </label>
              <input
                type="number"
                min="70"
                max="100"
                value={form.output_jpeg_quality}
                onChange={(e) => handleChange('output_jpeg_quality', parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
              <span className="text-[10px] text-slate-400">High: 95</span>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Border Stroke Width (px)
            </label>
            <input
              type="number"
              min="0"
              max="5"
              value={form.border_stroke_width_px}
              onChange={(e) => handleChange('border_stroke_width_px', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
            />
          </div>
        </div>

        {/* Section 2: 4x6 Sheet Layout Preferences */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Folder className="w-3.5 h-3.5 text-indigo-600" />
            <span>4×6 Sheet Preferences</span>
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Orientation
              </label>
              <select
                value={form.sheet_orientation}
                onChange={(e) => handleChange('sheet_orientation', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              >
                <option value="landscape">Landscape (6×4 in, 8 photos)</option>
                <option value="portrait">Portrait (4×6 in, 6 photos)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Cutting Guides
              </label>
              <div className="pt-2">
                <label className="flex items-center space-x-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enable_cutting_guides}
                    onChange={(e) => handleChange('enable_cutting_guides', e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <span>Enable Crop Marks</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Spacing Between Photos (mm)
              </label>
              <input
                type="number"
                step="0.5"
                value={form.sheet_spacing_mm}
                onChange={(e) => handleChange('sheet_spacing_mm', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Outer Margin (mm)
              </label>
              <input
                type="number"
                step="0.5"
                value={form.sheet_margin_mm}
                onChange={(e) => handleChange('sheet_margin_mm', parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Default Passport Blue Background
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={form.default_bg_color}
                onChange={(e) => handleChange('default_bg_color', e.target.value.toUpperCase())}
                className="w-8 h-8 rounded-lg border border-slate-300 p-0.5 cursor-pointer bg-white"
              />
              <input
                type="text"
                value={form.default_bg_color}
                onChange={(e) => handleChange('default_bg_color', e.target.value.toUpperCase())}
                maxLength={7}
                className="w-28 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold uppercase text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Photoshop & Action Path Settings */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Adobe Photoshop &amp; Action Automation Paths</span>
            </h2>
            <button
              type="button"
              onClick={handleAutoDetectPs}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
            >
              Auto-Detect Photoshop Path
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Photoshop Processing Mode
            </label>
            <select
              value={form.photoshop_engine_mode || 'auto'}
              onChange={(e) => handleChange('photoshop_engine_mode', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="auto">Auto (Photoshop CS6 Native if SkinFiner missing - Recommended)</option>
              <option value="native_cs6">Photoshop CS6 Native Engine (100% Plugin-Free)</option>
              <option value="action">Photoshop Action (PJK.atn with SkinFiner)</option>
              <option value="builtin_studio">Fast Built-in Studio Engine (Direct Python)</option>
            </select>
            <span className="text-[10px] text-slate-500 mt-1 block">
              Native CS6 Mode uses Photoshop's built-in Surface Blur filter and works on ANY CS6 system with zero plugin installation.
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Photoshop Executable Path
            </label>
            <input
              type="text"
              value={form.photoshop_exe_path}
              onChange={(e) => handleChange('photoshop_exe_path', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Photoshop Action File Path (.atn)
            </label>
            <input
              type="text"
              value={form.action_file_path}
              onChange={(e) => handleChange('action_file_path', e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Action Set Name
              </label>
              <input
                type="text"
                value={form.action_set_name}
                onChange={(e) => handleChange('action_set_name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Action Name
              </label>
              <input
                type="text"
                value={form.action_name}
                onChange={(e) => handleChange('action_name', e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center space-x-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_fallback_enhancement}
                onChange={(e) => handleChange('auto_fallback_enhancement', e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
              />
              <span>
                Enable Auto Fallback to Built-in Studio Passport Engine (Recommended)
              </span>
            </label>
            <p className="text-[11px] text-slate-500 mt-1 ml-6">
              If Photoshop or SkinFiner plugin is busy or missing, the built-in studio engine automatically performs the 35×45mm 300 DPI crop, edge-preserving skin softening, and border stroke without failing your print workflow.
            </p>
          </div>
        </div>

          {/* Section 4: Photoshop CS6 Compatibility Guide */}
          <div className="bg-blue-50/60 rounded-3xl p-6 border border-blue-200 md:col-span-2 space-y-3">
            <div className="flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
                  Photoshop CS6 Compatibility &amp; SkinFiner Information
                </h3>
            </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong>No SkinFiner plugin is required!</strong> If you cannot or do not wish to install SkinFiner in Adobe Photoshop CS6, PJK Studio runs Photoshop CS6 using its built-in, native <strong>Surface Blur</strong> edge-preserving skin softening engine.
              </p>
                <ul className="text-xs text-slate-600 list-disc list-inside space-y-1 pl-1">
                  <li>
                    <strong>Works on all Windows CS6 systems:</strong> 32-bit and 64-bit Photoshop CS6 operate cleanly without third-party plugin errors.
                  </li>
                  <li>
                    <strong>Preserves portrait fidelity:</strong> Retouches skin while keeping eyes, eyebrows, lips, hair, and clothing razor-sharp.
                  </li>
                  <li>
                    <strong>If you do have SkinFiner (.8bf):</strong> You can optionally place <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">SkinFiner.8bf</code> in your Photoshop <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">Plug-ins\</code> folder and switch the mode above to "Action".
                  </li>
            </ul>
          </div>
        </div>
    </form>
  );
};
