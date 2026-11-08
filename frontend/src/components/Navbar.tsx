import React from 'react';
import {
  Camera,
  Layers,
  Image as ImageIcon,
  Palette,
  History,
  Settings,
  CheckCircle2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { HealthResponse } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  health: HealthResponse | null;
  onRefreshHealth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  health,
  onRefreshHealth,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Camera },
    { id: 'passport', label: 'Passport Studio', icon: ImageIcon },
    { id: 'sheet', label: '4×6 Print Sheet', icon: Layers },
    { id: 'background', label: 'Background Studio', icon: Palette },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-blue-700 to-indigo-800 bg-clip-text text-transparent">
                  PJK XEROX
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  STUDIO
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500">
                Passport Photo Automation
              </p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* System Status Indicator */}
          <div className="flex items-center space-x-3">
            {health ? (
              <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                {/* Photoshop Status */}
                <div
                  className="flex items-center space-x-1"
                  title={health.photoshop_path || 'Photoshop not found'}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${health.photoshop_installed ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                  />
                  <span className="font-medium text-slate-700">
                    {health.photoshop_installed ? 'PS CS6' : 'Studio Engine'}
                  </span>
                </div>

                <span className="text-slate-300">|</span>

                {/* SkinFiner / Native Mode Status */}
                <div
                  className="flex items-center space-x-1"
                  title={
                    health.skinfiner_installed
                      ? 'SkinFiner plugin is active in Photoshop.'
                      : 'Photoshop CS6 Native Engine active (using built-in Surface Blur, no plugins needed).'
                  }
                >
                  {health.skinfiner_installed ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-medium">SkinFiner</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-700 font-medium">Native Retouch</span>
                    </>
                  )}
                </div>

                <button
                  onClick={onRefreshHealth}
                  className="text-slate-400 hover:text-slate-700 ml-1 p-0.5 rounded transition-colors"
                  title="Refresh status"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                <span>Checking system...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

