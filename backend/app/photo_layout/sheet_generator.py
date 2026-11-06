import math
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from PIL import Image, ImageOps, ImageDraw

from app.config.settings import get_settings

logger = logging.getLogger("sheet_generator")

class SheetItem:
    def __init__(self, photo_path: str, copies: int = 1):
        self.photo_path = photo_path
        self.copies = copies

class PhotoSheetGenerator:
    def __init__(self):
        self.settings = get_settings()

    def mm_to_px(self, mm: float, dpi: int) -> int:
        return int(round((mm / 25.4) * dpi))

    def in_to_px(self, inches: float, dpi: int) -> int:
        return int(round(inches * dpi))

    def calculate_grid(
        self,
        sheet_w_px: int,
        sheet_h_px: int,
        photo_w_px: int,
        photo_h_px: int,
        spacing_px: int,
        margin_px: int
    ) -> Dict[str, Any]:
        """Calculates optimal grid layout to fit maximum passport photos."""
        available_w = sheet_w_px - (2 * margin_px)
        available_h = sheet_h_px - (2 * margin_px)

        cols = max(1, (available_w + spacing_px) // (photo_w_px + spacing_px))
        rows = max(1, (available_h + spacing_px) // (photo_h_px + spacing_px))

        total_grid_w = (cols * photo_w_px) + ((cols - 1) * spacing_px)
        total_grid_h = (rows * photo_h_px) + ((rows - 1) * spacing_px)

        # Center the grid on the sheet
        start_x = max(0, (sheet_w_px - total_grid_w) // 2)
        start_y = max(0, (sheet_h_px - total_grid_h) // 2)

        return {
            "cols": int(cols),
            "rows": int(rows),
            "total_slots": int(cols * rows),
            "start_x": start_x,
            "start_y": start_y,
            "total_grid_w": total_grid_w,
            "total_grid_h": total_grid_h
        }

    def generate_sheet(
        self,
        photos: List[Dict[str, Any]],  # List of {"path": str, "copies": int}
        output_path: str,
        orientation: Optional[str] = None,
        passport_width_mm: Optional[float] = None,
        passport_height_mm: Optional[float] = None,
        spacing_mm: Optional[float] = None,
        margin_mm: Optional[float] = None,
        dpi: Optional[int] = None,
        add_cutting_guides: Optional[bool] = None,
        bg_color: str = "#FFFFFF"
    ) -> Dict[str, Any]:
        """
        Creates a 4x6 inch (300 DPI) photo sheet combining multiple photographs,
        accurately scaled, spaced, and arranged with optional cutting guides.
        """
        dpi = dpi or self.settings.dpi
        orientation = orientation or self.settings.sheet_orientation
        p_w_mm = passport_width_mm or self.settings.passport_width_mm
        p_h_mm = passport_height_mm or self.settings.passport_height_mm
        spacing_mm = spacing_mm if spacing_mm is not None else self.settings.sheet_spacing_mm
        margin_mm = margin_mm if margin_mm is not None else self.settings.sheet_margin_mm
        add_guides = add_cutting_guides if add_cutting_guides is not None else self.settings.enable_cutting_guides

        # 4x6 inch dimensions in pixels
        dim1 = self.in_to_px(6.0, dpi)  # 1800 px at 300 DPI
        dim2 = self.in_to_px(4.0, dpi)  # 1200 px at 300 DPI

        if orientation.lower() == "portrait":
            sheet_w = dim2  # 1200
            sheet_h = dim1  # 1800
        else:
            sheet_w = dim1  # 1800
            sheet_h = dim2  # 1200

        photo_w = self.mm_to_px(p_w_mm, dpi)
        photo_h = self.mm_to_px(p_h_mm, dpi)
        spacing_px = self.mm_to_px(spacing_mm, dpi)
        margin_px = self.mm_to_px(margin_mm, dpi)

        grid = self.calculate_grid(sheet_w, sheet_h, photo_w, photo_h, spacing_px, margin_px)
        cols = grid["cols"]
        rows = grid["rows"]
        total_slots = grid["total_slots"]

        # Build list of image file paths to place in each slot
        placed_photos: List[str] = []
        for item in photos:
            p_path = item.get("path")
            copies = int(item.get("copies", 1))
            if p_path and Path(p_path).exists():
                for _ in range(copies):
                    if len(placed_photos) < total_slots:
                        placed_photos.append(p_path)

        # Create blank sheet canvas (RGB, 300 DPI)
        sheet = Image.new("RGB", (sheet_w, sheet_h), bg_color)
        draw = ImageDraw.Draw(sheet)

        # Cache opened and pre-scaled images
        cached_imgs: Dict[str, Image.Image] = {}

        slot_index = 0
        slot_positions = []

        for r in range(rows):
            for c in range(cols):
                x = grid["start_x"] + c * (photo_w + spacing_px)
                y = grid["start_y"] + r * (photo_h + spacing_px)
                slot_positions.append({"x": x, "y": y, "w": photo_w, "h": photo_h})

                if slot_index < len(placed_photos):
                    img_path = placed_photos[slot_index]
                    if img_path not in cached_imgs:
                        raw = Image.open(img_path)
                        raw = ImageOps.exif_transpose(raw)
                        raw = raw.convert("RGB")
                        # Crop to exact passport aspect ratio then resize
                        cur_w, cur_h = raw.size
                        ratio = photo_w / photo_h
                        if cur_w / cur_h > ratio:
                            new_w = int(cur_h * ratio)
                            left = (cur_w - new_w) // 2
                            raw = raw.crop((left, 0, left + new_w, cur_h))
                        else:
                            new_h = int(cur_w / ratio)
                            top = max(0, int((cur_h - new_h) * 0.25))
                            raw = raw.crop((0, top, cur_w, top + new_h))
                        scaled = raw.resize((photo_w, photo_h), Image.Resampling.LANCZOS)
                        cached_imgs[img_path] = scaled

                    photo_to_paste = cached_imgs[img_path]
                    sheet.paste(photo_to_paste, (x, y))

                    # Optional subtle 1px photo border
                    draw.rectangle([x, y, x + photo_w - 1, y + photo_h - 1], outline="#CCCCCC", width=1)

                    # Cutting guides (corner crop marks or subtle outer lines)
                    if add_guides:
                        guide_len = self.mm_to_px(2.0, dpi)
                        g_color = "#999999"
                        # Top-left corner
                        draw.line([(x - 4, y), (x - 4 - guide_len, y)], fill=g_color, width=1)
                        draw.line([(x, y - 4), (x, y - 4 - guide_len)], fill=g_color, width=1)
                        # Top-right corner
                        draw.line([(x + photo_w + 3, y), (x + photo_w + 3 + guide_len, y)], fill=g_color, width=1)
                        draw.line([(x + photo_w - 1, y - 4), (x + photo_w - 1, y - 4 - guide_len)], fill=g_color, width=1)
                        # Bottom-left corner
                        draw.line([(x - 4, y + photo_h - 1), (x - 4 - guide_len, y + photo_h - 1)], fill=g_color, width=1)
                        draw.line([(x, y + photo_h + 3), (x, y + photo_h + 3 + guide_len)], fill=g_color, width=1)
                        # Bottom-right corner
                        draw.line([(x + photo_w + 3, y + photo_h - 1), (x + photo_w + 3 + guide_len, y + photo_h - 1)], fill=g_color, width=1)
                        draw.line([(x + photo_w - 1, y + photo_h + 3), (x + photo_w - 1, y + photo_h + 3 + guide_len)], fill=g_color, width=1)

                slot_index += 1

        # Save output high-quality JPEG
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        sheet.save(output_path, format="JPEG", quality=self.settings.output_jpeg_quality, dpi=(dpi, dpi))

        return {
            "output_path": output_path,
            "width_px": sheet_w,
            "height_px": sheet_h,
            "dpi": dpi,
            "orientation": orientation,
            "columns": cols,
            "rows": rows,
            "total_slots": total_slots,
            "photos_placed": len(placed_photos),
            "slots": slot_positions
        }


sheet_generator = PhotoSheetGenerator()
