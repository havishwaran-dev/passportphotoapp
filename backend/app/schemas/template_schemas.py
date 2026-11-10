from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class TemplateTextSlot(BaseModel):
    layer_name: str
    original_text: str
    bbox: Optional[List[int]] = None # [x1, y1, x2, y2]
    font_size: Optional[int] = None

class TemplatePhotoSlot(BaseModel):
    layer_name: str
    slot_id: str
    display_name: Optional[str] = None
    bbox: List[int] # [x1, y1, x2, y2]
    width: int
    height: int
    kind: str = "pixel"
    has_clipping_mask: Optional[bool] = False

class TemplateSummary(BaseModel):
    template_id: str
    name: str
    category: str
    file_path: str
    width: int
    height: int
    photo_slots_count: int
    text_slots_count: int
    preview_url: str

class TemplateDetail(BaseModel):
    template_id: str
    name: str
    category: str
    file_path: str
    width: int
    height: int
    photo_slots: List[TemplatePhotoSlot]
    text_slots: List[TemplateTextSlot]
    preview_url: str

class PhotoSlotAssignment(BaseModel):
    slot_name: str
    photo_id: str

class TextSlotAssignment(BaseModel):
    layer_name: str
    text: str

class GenerateTemplateRequest(BaseModel):
    template_id: str
    photo_assignments: List[PhotoSlotAssignment] = []
    text_assignments: List[TextSlotAssignment] = []
    engine: Optional[str] = "fast_studio" # "fast_studio" or "photoshop_cs6"
    jpeg_quality: Optional[int] = 95
