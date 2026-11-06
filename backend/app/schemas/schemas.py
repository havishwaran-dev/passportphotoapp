from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class PhotoInfo(BaseModel):
    photo_id: str
    filename: str
    original_name: str
    width: int
    height: int
    url: str
    thumbnail_url: str
    size_bytes: int

class PhotoUploadResponse(BaseModel):
    success: bool
    photos: List[PhotoInfo]
    message: str = "Uploaded successfully"

class ProcessPassportRequest(BaseModel):
    photo_id: str
    action_name: Optional[str] = None
    action_set: Optional[str] = None
    auto_fallback: bool = True

class ReplaceBackgroundRequest(BaseModel):
    photo_id: str
    bg_color: str = "#0080FF"  # Default PJK Blue

class ProcessCompleteRequest(BaseModel):
    photo_id: str
    bg_color: Optional[str] = "#0080FF"  # or 'original' to skip bg change
    auto_fallback: bool = True

class SheetPhotoItem(BaseModel):
    photo_id: str
    copies: int = 1

class GenerateSheetRequest(BaseModel):
    photos: List[SheetPhotoItem]
    orientation: Optional[str] = "landscape"  # "landscape" or "portrait"
    spacing_mm: Optional[float] = None
    margin_mm: Optional[float] = None
    cutting_guides: Optional[bool] = True
    bg_color: str = "#FFFFFF"

class RotatePhotoRequest(BaseModel):
    photo_id: str
    angle: int  # 90, 180, 270, -90

class JobResponse(BaseModel):
    job_id: str
    mode: str
    status: str
    progress: int
    message: str
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None
    input_photo_id: Optional[str] = None
    output_photo_id: Optional[str] = None
    sheet_id: Optional[str] = None
    result_url: Optional[str] = None
    preview_url: Optional[str] = None
    error: Optional[str] = None
    meta: Dict[str, Any] = {}

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    photoshop_installed: bool
    photoshop_path: Optional[str]
    photoshop_running: bool
    skinfiner_installed: bool
    skinfiner_info: str
    action_file_exists: bool
    action_file_path: str
    action_set_name: str
    action_name: str
    stats: Dict[str, Any]
