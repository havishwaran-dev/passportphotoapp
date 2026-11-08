import json
import os
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BASE_DIR.parent
CONFIG_FILE = Path(__file__).resolve().parent / "settings.json"

class AppSettings(BaseModel):
    # Photoshop settings
    photoshop_exe_path: str = r"C:\Program Files\Adobe\Adobe Photoshop CS6 (x64)\Photoshop.exe"
    action_file_path: str = str(PROJECT_ROOT / "PJK.atn")
    action_set_name: str = "PJK"
    action_name: str = "passport"
    photoshop_engine_mode: str = "auto"  # "auto", "native_cs6" (no plugins), "action" (PJK.atn), "builtin_studio"

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

                # Ensure portable paths if moved to another computer
                if "action_file_path" in data and not Path(data["action_file_path"]).exists():
                    data["action_file_path"] = str(PROJECT_ROOT / "PJK.atn")
                if "upload_folder" in data and not Path(data["upload_folder"]).parent.exists():
                    data["upload_folder"] = str(BASE_DIR / "uploads")
                if "output_folder" in data and not Path(data["output_folder"]).parent.exists():
                    data["output_folder"] = str(BASE_DIR / "outputs")
                if "temp_folder" in data and not Path(data["temp_folder"]).parent.exists():
                    data["temp_folder"] = str(BASE_DIR / "temp")

                _settings_instance = AppSettings(**data)
            except Exception as e:
                print(f"[Settings] Error loading {CONFIG_FILE}: {e}, using defaults")
                _settings_instance = AppSettings()
        else:
            _settings_instance = AppSettings()
            save_settings(_settings_instance)

    # Ensure folders exist
    Path(_settings_instance.upload_folder).mkdir(parents=True, exist_ok=True)
    Path(_settings_instance.output_folder).mkdir(parents=True, exist_ok=True)
    Path(_settings_instance.temp_folder).mkdir(parents=True, exist_ok=True)

    return _settings_instance

def save_settings(new_settings: AppSettings) -> AppSettings:
    global _settings_instance
    _settings_instance = new_settings
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(new_settings.model_dump(), f, indent=2)
    return _settings_instance
