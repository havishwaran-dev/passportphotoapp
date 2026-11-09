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
  mode: 'passport' | 'background' | 'complete' | 'sheet' | 'collage';
  status: JobStatus;
  progress: number;
  message: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  input_photo_id?: string;
  output_photo_id?: string;
  sheet_id?: string;
  collage_id?: string;
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
  photoshop_engine_mode?: 'auto' | 'native_cs6' | 'action' | 'builtin_studio';
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
  native_cs6_supported?: boolean;
  active_engine_mode?: string;
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

export interface CollageTemplate {
  id: string;
  name: string;
  description: string;
  badge: string;
}

export interface CollageTheme {
  id: string;
  name: string;
  preview_bg: string;
  preview_accent: string;
}

export interface CollageFont {
  id: string;
  name: string;
  preview: string;
}

export interface CollagePresetsResponse {
  templates: CollageTemplate[];
  themes: CollageTheme[];
  fonts: CollageFont[];
}

export interface GenerateCollagePayload {
  photos: string[]; // 2 to 20 photo_ids
  orientation?: 'portrait' | 'landscape';
  template_id?: string;
  theme_id?: string;
  custom_bg_color?: string;
  title?: string;
  name?: string;
  subtitle?: string;
  font_family?: string;
  font_size_scale?: number;
  show_decorations?: boolean;
  rounded_corners?: boolean;
  border_width?: number;
}

export interface TemplateCategory {
  name: string;
  count: number;
}

export interface TemplateSummary {
  template_id: string;
  name: string;
  category: string;
  file_path: string;
  width: number;
  height: number;
  photo_slots_count: number;
  text_slots_count: number;
  preview_url: string;
}

export interface TemplatesListResponse {
  total: number;
  limit: number;
  offset: number;
  templates: TemplateSummary[];
}

export interface TemplatePhotoSlot {
  layer_name: string;
  slot_id: string;
  bbox: [number, number, number, number];
  width: number;
  height: number;
  kind: string;
}

export interface TemplateTextSlot {
  layer_name: string;
  original_text: string;
  bbox?: [number, number, number, number];
  font_size?: number;
}

export interface TemplateDetail {
  template_id: string;
  name: string;
  category: string;
  file_path: string;
  width: number;
  height: number;
  photo_slots: TemplatePhotoSlot[];
  text_slots: TemplateTextSlot[];
  preview_url: string;
}

export interface PhotoSlotAssignment {
  slot_name: string;
  photo_id: string;
}

export interface TextSlotAssignment {
  layer_name: string;
  text: string;
}

export interface GenerateTemplatePayload {
  template_id: string;
  photo_assignments: PhotoSlotAssignment[];
  text_assignments: TextSlotAssignment[];
  engine?: string;
  jpeg_quality?: number;
}
