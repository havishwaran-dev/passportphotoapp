import json
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
CONFIG_FILE = Path(__file__).resolve().parent / "settings.json"

class AppSettings(BaseModel):
    # Photoshop settings
    photoshop_exe_path: str = r"C:\Program Files\Adobe\Adobe Photoshop CS6 (x64)\Photoshop.exe"
    action_file_path: str = r"C:\FreePro\passportphotoapp\PJK.atn"
    action_set_name: str = "PJK"
    action_name: str = "passport"

    # Passport photo specs
    passport_width_mm: float = 35.0
    passport_height_mm: float = 45.0
    dpi: int = 300
    output_jpeg_quality: int = 95
    border_stroke_width_px: int = 2
    border_stroke_color: str = "#CCCCCC"

    # Background replacement colors
    default_bg_color: str = "#0080FF"
    custom_default_color: str = "#FFFFFF"

    # 4x6 Sheet layout
    sheet_width_in: float = 6.0
    sheet_height_in: float = 4.0
    sheet_spacing_mm: float = 3.0
    sheet_margin_mm: float = 4.0
    sheet_orientation: str = "landscape"  # "landscape" or "portrait"
    enable_cutting_guides: bool = True

    # Directories
    upload_folder: str = str(BASE_DIR / "uploads")
    output_folder: str = str(BASE_DIR / "outputs")
    temp_folder: str = str(BASE_DIR / "temp")

    # Processing options
    auto_fallback_enhancement: bool = True  # If SkinFiner/Photoshop missing, perform built-in studio enhancement


_settings_instance: Optional[AppSettings] = None

def get_settings() -> AppSettings:
    global _settings_instance
    if _settings_instance is None:
        if CONFIG_FILE.exists():
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    _settings_instance = AppSettings(**data)
            except Exception as e:
                print(f"[Settings] Error loading {CONFIG_FILE}: {e}, using defaults")
                _settings_instance = AppSettings()
        else:
            _settings_instance = AppSettings()
            save_settings(_settings_instance)
    return _settings_instance

def save_settings(new_settings: AppSettings) -> AppSettings:
    global _settings_instance
    _settings_instance = new_settings
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(new_settings.model_dump(), f, indent=2)
    return _settings_instance

