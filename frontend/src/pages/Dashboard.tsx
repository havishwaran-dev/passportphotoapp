import React from 'react';
import {
  Camera,
  Layers,
  Palette,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';
import { HealthResponse, JobResponse } from '../types';

interface DashboardProps {
  health: HealthResponse | null;
  history: JobResponse[];
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  health,
  history,
  onNavigate,
}) => {
  const stats = health?.stats || {
    total_photos_processed: 0,
    photos_processed_today: 0,
    total_sheets_generated: 0,
    sheets_generated_today: 0,
    total_jobs: 0,
  };

  const recentJobs = history.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-blue-500/30 border border-blue-400/40 rounded-full px-3 py-1 text-xs font-semibold mb-3 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-200" />
            <span>PJK Xerox Printing Shop Automation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Passport Photo Automation Studio
          </h1>
          <p className="mt-2 text-sm text-blue-100/90 leading-relaxed">
            Automate standard 35×45 mm passport photo enhancement via Photoshop CS6 (<code className="text-blue-200 font-mono">PJK &gt; passport</code>) and high-precision AI background replacement.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('passport')}
              className="inline-flex items-center space-x-2 bg-white text-blue-800 hover:bg-blue-50 px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all active:scale-95"
            >
              <Camera className="w-4 h-4 text-blue-600" />
              <span>Process Passport Photo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('sheet')}
              className="inline-flex items-center space-x-2 bg-blue-600/60 hover:bg-blue-600 border border-blue-400/40 text-white px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-xs transition-all active:scale-95"
            >
              <Layers className="w-4 h-4" />
              <span>Create 4×6 Sheet</span>
            </button>
            <button
              onClick={() => onNavigate('background')}
              className="inline-flex items-center space-x-2 bg-blue-600/60 hover:bg-blue-600 border border-blue-400/40 text-white px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-xs transition-all active:scale-95"
            >
              <Palette className="w-4 h-4" />
              <span>Replace Background</span>
            </button>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-indigo-500/20 to-transparent pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Photos Today
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-900">
              {stats.photos_processed_today}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              Daily
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Processed
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-blue-600">
              {stats.total_photos_processed}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              All time
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            4×6 Sheets Today
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-slate-900">
              {stats.sheets_generated_today}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              Sheets
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Sheets
          </p>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-3xl font-black text-indigo-600">
              {stats.total_sheets_generated}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Total
            </span>
          </div>
        </div>
      </div>

      {/* System Status & Plugins Check */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Photoshop Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Photoshop Status
            </span>
            {health?.photoshop_installed ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                <span>Installed</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertTriangle className="w-3 h-3" />
                <span>Not Detected</span>
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Adobe Photoshop CS6 (x64)
          </p>
          <p className="text-xs text-slate-500 mt-1 truncate" title={health?.photoshop_path || ''}>
            {health?.photoshop_path || 'Standard Adobe path'}
          </p>
        </div>

        {/* Action Set Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Photoshop Action
            </span>
            {health?.action_file_exists ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                <span>Missing ATN</span>
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Action: <span className="text-blue-600 font-mono">PJK &gt; passport</span>
          </p>
          <p className="text-xs text-slate-500 mt-1 truncate" title={health?.action_file_path || ''}>
            {health?.action_file_path || 'PJK.atn'}
          </p>
        </div>

        {/* SkinFiner Plugin Status */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              SkinFiner Plugin
            </span>
            {health?.skinfiner_installed ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                <span>Available</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3" />
                <span>Not Installed</span>
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {health?.skinfiner_installed ? 'Plugin Active' : 'Fallback Active'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {health?.skinfiner_installed
              ? 'Skin smoothing runs natively in action.'
              : 'Auto-fallback provides high-res studio enhancement.'}
          </p>
        </div>
      </div>

      {!health?.skinfiner_installed && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 text-amber-900">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-amber-800 text-sm">
              Notice: SkinFiner Plugin Detection
            </p>
            <p>
              The Photoshop action <code className="font-mono font-semibold">PJK &gt; passport</code> contains a step for <strong>SkinFiner</strong>. Because SkinFiner is not installed on this system, the application automatically uses the <strong>Built-in Studio Passport Engine</strong> (35×45mm 300 DPI crop, edge-preserving skin softening, and border stroke) so photo printing is never interrupted.
            </p>
            <p className="text-amber-700 pt-1">
              To install SkinFiner into Photoshop CS6, place <code className="font-mono">SkinFiner.8bf</code> into <code className="font-mono">C:\Program Files\Adobe\Adobe Photoshop CS6 (x64)\Plug-ins\</code> and restart Photoshop.
            </p>
          </div>
        </div>
      )}

      {/* Recent Processing History */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Processing Jobs</h2>
            <p className="text-xs text-slate-500">History of passport photos and 4×6 sheets</p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
          >
            <span>View All History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl">
            <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No jobs processed yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Upload a photograph to get started with your first passport photo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentJobs.map((job) => (
              <div
                key={job.job_id}
                className="flex items-center space-x-3 p-3 rounded-2xl border border-slate-200 hover:border-slate-300 transition-colors bg-slate-50/50"
              >
                {job.preview_url ? (
                  <img
                    src={job.preview_url}
                    alt="Processed"
                    className="w-16 h-20 object-cover rounded-xl border border-slate-200 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                    <Camera className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        job.mode === 'passport'
                          ? 'bg-blue-100 text-blue-700'
                          : job.mode === 'sheet'
                          ? 'bg-purple-100 text-purple-700'
                          : job.mode === 'background'
                          ? 'bg-cyan-100 text-cyan-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {job.mode}
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        job.status === 'completed'
                          ? 'text-emerald-600'
                          : job.status === 'failed'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 truncate mt-1">
                    {job.message}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(job.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {job.result_url && (
                  <a
                    href={job.result_url}
                    download
                    className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors shadow-2xs"
                    title="Download high-res result"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

