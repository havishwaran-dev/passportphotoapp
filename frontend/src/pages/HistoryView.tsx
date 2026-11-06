import React, { useState } from 'react';
import {
  History,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Camera,
  Palette,
  RefreshCw
} from 'lucide-react';
import { JobResponse } from '../types';

interface HistoryViewProps {
  history: JobResponse[];
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onRefresh,
}) => {
  const [filterMode, setFilterMode] = useState<string>('all');

  const filtered = history.filter((job) => {
    if (filterMode === 'all') return true;
    return job.mode === filterMode;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <History className="w-5 h-5 text-blue-600" />
            <span>Processing History</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {history.length} Jobs
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Log of all passport photos, 4×6 print sheets, and background replacement jobs.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mode Filters */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
            {[
              { id: 'all', label: 'All' },
              { id: 'passport', label: 'Passport' },
              { id: 'complete', label: 'Complete' },
              { id: 'sheet', label: '4×6 Sheet' },
              { id: 'background', label: 'Background' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterMode(f.id)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  filterMode === f.id
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={onRefresh}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-2xs"
            title="Refresh History"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-2xs">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">No matching jobs found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Jobs will appear here once photographs or sheets are processed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((job) => (
            <div
              key={job.job_id}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start space-x-3">
                {job.preview_url ? (
                  <img
                    src={job.preview_url}
                    alt="Preview"
                    className="w-16 h-20 object-cover rounded-xl border border-slate-200 shadow-2xs shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-400 border border-slate-200">
                    {job.mode === 'sheet' ? (
                      <Layers className="w-6 h-6" />
                    ) : job.mode === 'background' ? (
                      <Palette className="w-6 h-6" />
                    ) : (
                      <Camera className="w-6 h-6" />
                    )}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-1.5 mb-1">
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
                      className={`text-[10px] font-bold inline-flex items-center space-x-0.5 ${
                        job.status === 'completed'
                          ? 'text-emerald-600'
                          : job.status === 'failed'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {job.status === 'completed' ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                      <span className="capitalize">{job.status}</span>
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                    {job.message}
                  </p>

                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    {new Date(job.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {job.error && (
                <div className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 font-medium break-words">
                  {job.error}
                </div>
              )}

              {job.result_url && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {job.job_id.slice(0, 8)}
                  </span>
                  <a
                    href={job.result_url}
                    download
                    className="inline-flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

