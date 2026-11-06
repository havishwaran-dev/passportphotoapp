export interface PhotoInfo {
  photo_id: string;
  filename: string;
  original_name: string;
  width: number;
  height: number;
  url: string;
  thumbnail_url: string;
  size_bytes: number;
}

export interface PhotoUploadResponse {
  success: boolean;
  photos: PhotoInfo[];
  message: string;
}

export type JobStatus =
  | 'waiting'
  | 'uploading'
  | 'preparing'
  | 'background_replacement'
  | 'opening_photoshop'
  | 'running_action'
  | 'generating_sheet'
  | 'completed'
  | 'failed';

export interface JobResponse {
  job_id: string;
  mode: 'passport' | 'background' | 'complete' | 'sheet';
  status: JobStatus;
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  input_photo_id?: string;
  output_photo_id?: string;
  sheet_id?: string;
  result_url?: string;
  preview_url?: string;
  error?: string;
  meta: Record<string, any>;
}

export interface AppSettings {
  photoshop_exe_path: string;
  action_file_path: string;
  action_set_name: string;
  action_name: string;
  passport_width_mm: number;
  passport_height_mm: number;
  dpi: number;
  output_jpeg_quality: number;
  border_stroke_width_px: number;
  border_stroke_color: string;
  default_bg_color: string;
  custom_default_color: string;
  sheet_width_in: number;
  sheet_height_in: number;
  sheet_spacing_mm: number;
  sheet_margin_mm: number;
  sheet_orientation: 'landscape' | 'portrait';
  enable_cutting_guides: boolean;
  upload_folder: string;
  output_folder: string;
  temp_folder: string;
  auto_fallback_enhancement: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  photoshop_installed: boolean;
  photoshop_path?: string;
  photoshop_running: boolean;
  skinfiner_installed: boolean;
  skinfiner_info: string;
  action_file_exists: boolean;
  action_file_path: string;
  action_set_name: string;
  action_name: string;
  stats: {
    total_photos_processed: number;
    photos_processed_today: number;
    total_sheets_generated: number;
    sheets_generated_today: number;
    total_jobs: number;
  };
}

export interface SheetPhotoItem {
  photo_id: string;
  copies: number;
  photo?: PhotoInfo;
}
