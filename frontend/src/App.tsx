import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './pages/Dashboard';
import { PassportStudio } from './pages/PassportStudio';
import { SheetStudio } from './pages/SheetStudio';
import { BackgroundStudio } from './pages/BackgroundStudio';
import { HistoryView } from './pages/HistoryView';
import { SettingsPage } from './pages/SettingsPage';
import type { HealthResponse, AppSettings, PhotoInfo, JobResponse } from './types';
import { fetchHealth, fetchSettings, fetchHistory } from './services/api';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoInfo[]>([]);
  const [history, setHistory] = useState<JobResponse[]>([]);

  const loadInitialData = async () => {
    try {
      const [h, s, hist] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchSettings().catch(() => null),
        fetchHistory().catch(() => []),
      ]);
      if (h) setHealth(h);
      if (s) setSettings(s);
      if (hist) setHistory(hist);
    } catch (e) {
      console.error('Error loading initial data:', e);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleRefreshHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (e) {
      console.error('Failed to refresh health:', e);
    }
  };

  const handleRefreshHistory = async () => {
    try {
      const hist = await fetchHistory();
      setHistory(hist);
      const h = await fetchHealth();
      setHealth(h);
    } catch (e) {
      console.error('Failed to refresh history:', e);
    }
  };

  const handleAddToSheet = (photo: PhotoInfo) => {
    setUploadedPhotos((prev) => {
      if (prev.some((p) => p.photo_id === photo.photo_id)) return prev;
      return [...prev, photo];
    });
    setCurrentTab('sheet');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        health={health}
        onRefreshHealth={handleRefreshHealth}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'dashboard' && (
          <Dashboard
            health={health}
            history={history}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'passport' && (
          <PassportStudio
            settings={settings}
            uploadedPhotos={uploadedPhotos}
            setUploadedPhotos={setUploadedPhotos}
            onAddToSheet={handleAddToSheet}
            onJobFinished={handleRefreshHistory}
          />
        )}

        {currentTab === 'sheet' && (
          <SheetStudio
            settings={settings}
            photos={uploadedPhotos}
            setPhotos={setUploadedPhotos}
            onJobFinished={handleRefreshHistory}
          />
        )}

        {currentTab === 'background' && (
          <BackgroundStudio
            settings={settings}
            photos={uploadedPhotos}
            setPhotos={setUploadedPhotos}
            onAddToSheet={handleAddToSheet}
            onJobFinished={handleRefreshHistory}
          />
        )}

        {currentTab === 'history' && (
          <HistoryView
            history={history}
            onRefresh={handleRefreshHistory}
          />
        )}

        {currentTab === 'settings' && (
          <SettingsPage
            settings={settings}
            onSettingsSaved={(updated) => setSettings(updated)}
            health={health}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {new Date().getFullYear()} PJK Xerox. All rights reserved.</p>
          <p className="flex items-center space-x-1">
            <span>Powered by</span>
            <span className="font-bold text-slate-700">PJK Automation Studio</span>
            <span>• Local Desktop-Web Engine</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
