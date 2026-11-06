import {
  HealthResponse,
  AppSettings,
  JobResponse,
  PhotoUploadResponse,
  PhotoInfo,
  SheetPhotoItem
} from '../types';

const API_BASE = '';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`);
  if (!res.ok) throw new Error(`Failed to load settings: ${res.statusText}`);
  return res.json();
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`Failed to save settings: ${res.statusText}`);
  return res.json();
}

export async function fetchHistory(): Promise<JobResponse[]> {
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error(`Failed to load history: ${res.statusText}`);
  return res.json();
}

export async function fetchStats(): Promise<HealthResponse['stats']> {
  const res = await fetch(`${API_BASE}/api/history/stats`);
  if (!res.ok) throw new Error(`Failed to load stats: ${res.statusText}`);
  return res.json();
}

export async function uploadPhotos(files: File[]): Promise<PhotoUploadResponse> {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  const res = await fetch(`${API_BASE}/api/photos/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function rotatePhoto(photoId: string, angle: number): Promise<PhotoInfo> {
  const res = await fetch(`${API_BASE}/api/photos/rotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, angle }),
  });
  if (!res.ok) throw new Error(`Rotate failed: ${res.statusText}`);
  return res.json();
}

export async function processPassport(photoId: string, autoFallback: boolean = true): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/api/photos/process-passport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, auto_fallback: autoFallback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Process passport failed');
  }
  return res.json();
}

export async function replaceBackground(photoId: string, bgColor: string): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/api/photos/replace-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, bg_color: bgColor }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Background replacement failed');
  }
  return res.json();
}

export async function processComplete(
  photoId: string,
  bgColor: string = '#0080FF',
  autoFallback: boolean = true
): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/api/photos/process-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photo_id: photoId, bg_color: bgColor, auto_fallback: autoFallback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Complete passport processing failed');
  }
  return res.json();
}

export async function generateSheet(
  photos: { photo_id: string; copies: number }[],
  orientation: 'landscape' | 'portrait' = 'landscape',
  spacingMm?: number,
  marginMm?: number,
  cuttingGuides: boolean = true,
  bgColor: string = '#FFFFFF'
): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/api/sheets/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photos,
      orientation,
      spacing_mm: spacingMm,
      margin_mm: marginMm,
      cutting_guides: cuttingGuides,
      bg_color: bgColor,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Sheet generation failed');
  }
  return res.json();
}

export async function getJob(jobId: string): Promise<JobResponse> {
  const res = await fetch(`${API_BASE}/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(`Failed to fetch job ${jobId}`);
  return res.json();
}

/**
 * Polls job status until completed or failed
 */
export async function pollJob(
  jobId: string,
  onProgress?: (job: JobResponse) => void,
  intervalMs: number = 750,
  maxAttempts: number = 100
): Promise<JobResponse> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const job = await getJob(jobId);
    if (onProgress) onProgress(job);
    if (job.status === 'completed' || job.status === 'failed') {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    attempts++;
  }
  throw new Error('Processing timed out');
}
