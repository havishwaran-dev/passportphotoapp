import os
import hashlib
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageOps
from psd_tools import PSDImage

from app.config.settings import get_settings

logger = logging.getLogger("template_service")

# Default library paths
DEFAULT_PSD_PATHS = [
    Path(r"C:\photodesings"),
    Path(__file__).resolve().parent.parent.parent.parent / "templates" / "psd"
]

class TemplateService:
    def __init__(self):
        self.settings = get_settings()
        self.cache_dir = Path(self.settings.output_folder) / "template_previews"
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.meta_cache_file = self.cache_dir / "templates_index.json"
        self._index: Dict[str, Dict[str, Any]] = {}
        self._categories: Dict[str, int] = {}
        self.load_or_build_index()

    def get_template_id(self, file_path: Path) -> str:
        """Returns deterministic 12-char hash for a file path."""
        return hashlib.md5(str(file_path).lower().encode("utf-8")).hexdigest()[:12]

    def load_or_build_index(self, force_refresh: bool = False):
        """Loads cached index or scans template directories."""
        if not force_refresh and self.meta_cache_file.exists():
            try:
                with open(self.meta_cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._index = data.get("templates", {})
                    self._categories = data.get("categories", {})
                    if self._index:
                        logger.info(f"Loaded {len(self._index)} PSD templates from cache.")
                        return
            except Exception as e:
                logger.warning(f"Failed to read template index cache: {e}")

        self.scan_and_index()

    def scan_and_index(self):
        """Scans C:\\photodesings and indexes all PSD templates."""
        logger.info("Scanning PSD template directories...")
        self._index = {}
        self._categories = {}

        for root_dir in DEFAULT_PSD_PATHS:
            if not root_dir.exists():
                continue

            for ext in ["*.psd", "*.PSD"]:
                for psd_file in root_dir.rglob(ext):
                    if psd_file.name.startswith("._") or psd_file.name.startswith("~"):
                        continue

                    # Category name is top-level subfolder inside root
                    rel = psd_file.relative_to(root_dir)
                    category = rel.parts[0] if len(rel.parts) > 1 else "General Templates"
                    tid = self.get_template_id(psd_file)

                    self._index[tid] = {
                        "template_id": tid,
                        "name": psd_file.stem,
                        "category": category,
                        "file_path": str(psd_file),
                        "width": 2400, # default placeholder until inspected
                        "height": 3600,
                        "photo_slots_count": 1,
                        "text_slots_count": 1,
                        "has_preview": False
                    }
                    self._categories[category] = self._categories.get(category, 0) + 1

        logger.info(f"Indexed {len(self._index)} PSD templates across {len(self._categories)} categories.")
        self.save_index()

    def save_index(self):
        try:
            with open(self.meta_cache_file, "w", encoding="utf-8") as f:
                json.dump({"templates": self._index, "categories": self._categories}, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save template cache: {e}")

    def get_categories(self) -> List[Dict[str, Any]]:
        return [{"name": k, "count": v} for k, v in sorted(self._categories.items(), key=lambda x: -x[1])]

    def list_templates(
        self,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """Returns paginated list of templates with search and category filters."""
        results = list(self._index.values())

        if category and category != "all":
            results = [t for t in results if t["category"].lower() == category.lower()]

        if search:
            q = search.lower().strip()
            results = [t for t in results if q in t["name"].lower() or q in t["category"].lower()]

        total = len(results)
        page_items = results[offset : offset + limit]

        # Ensure previews exist for items on current page
        formatted = []
        for item in page_items:
            preview_url = f"/api/templates/{item['template_id']}/preview"
            formatted.append({
                "template_id": item["template_id"],
                "name": item["name"],
                "category": item["category"],
                "file_path": item["file_path"],
                "width": item.get("width", 2400),
                "height": item.get("height", 3600),
                "photo_slots_count": item.get("photo_slots_count", 1),
                "text_slots_count": item.get("text_slots_count", 1),
                "preview_url": preview_url
            })

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "templates": formatted
        }

    def get_template_preview_file(self, template_id: str) -> Path:
        """Returns or creates a fast 600px preview JPEG for the template."""
        preview_path = self.cache_dir / f"prev_{template_id}.jpg"
        if preview_path.exists() and preview_path.stat().st_size > 0:
            return preview_path

        info = self._index.get(template_id)
        if not info:
            raise FileNotFoundError(f"Template {template_id} not found in index.")

        psd_path = Path(info["file_path"])
        if not psd_path.exists():
            raise FileNotFoundError(f"PSD file {psd_path} does not exist.")

        # Check if a sibling JPEG exists in the same folder or JPEG subfolder
        parent = psd_path.parent
        sibling_candidates = [
            parent / f"{psd_path.stem}.jpg",
            parent / f"{psd_path.stem}.jpeg",
            parent / "JPEG" / f"{psd_path.stem}.jpg",
            parent / "JPEG" / f"{psd_path.stem}.jpeg",
        ]
        for sc in sibling_candidates:
            if sc.exists():
                try:
                    with Image.open(sc) as im:
                        im.thumbnail((800, 800), Image.Resampling.LANCZOS)
                        im.convert("RGB").save(preview_path, format="JPEG", quality=85)
                        return preview_path
                except Exception:
                    pass

        # Fast embedded preview directly from PSD header in ~0.2s
        try:
            psd = PSDImage.open(str(psd_path))
            comp = psd.topil()
            if comp:
                comp.thumbnail((600, 600), Image.Resampling.LANCZOS)
                comp.convert("RGB").save(preview_path, format="JPEG", quality=80)
                return preview_path
        except Exception as e:
            logger.warning(f"Could not load embedded preview for {psd_path}: {e}")

        # Fallback placeholder if PSD read failed
        placeholder = Image.new("RGB", (600, 800), color=(30, 41, 59))
        draw = ImageDraw.Draw(placeholder)
        draw.text((80, 380), f"PSD TEMPLATE\n{info['name'][:24]}", fill=(255, 255, 255))
        placeholder.save(preview_path, format="JPEG", quality=80)
        return preview_path

    def inspect_template_details(self, template_id: str) -> Dict[str, Any]:
        """Deeply inspects text layers and photo slots of a specific template."""
        info = self._index.get(template_id)
        if not info:
            raise FileNotFoundError(f"Template {template_id} not found.")

        psd_path = Path(info["file_path"])
        psd = PSDImage.open(str(psd_path))

        text_slots = []
        photo_slots = []

        slot_idx = 1
        for l in psd:
            kind = getattr(l, "kind", "pixel")
            if kind == "type":
                text_content = getattr(l, "text", "") or l.name
                bbox = list(l.bbox) if getattr(l, "bbox", None) else [0, 0, 100, 50]
                text_slots.append({
                    "layer_name": l.name,
                    "original_text": text_content.strip() or l.name,
                    "bbox": bbox,
                    "font_size": int((bbox[3] - bbox[1]) * 0.8) if len(bbox) == 4 else 36
                })
            elif getattr(l, "bbox", None) and l.name.lower() != "background":
                bx1, by1, bx2, by2 = l.bbox
                bw = bx2 - bx1
                bh = by2 - by1
                if bw > 180 and bh > 180:
                    photo_slots.append({
                        "layer_name": l.name,
                        "slot_id": f"slot_{slot_idx}",
                        "bbox": [bx1, by1, bx2, by2],
                        "width": bw,
                        "height": bh,
                        "kind": kind
                    })
                    slot_idx += 1

        # If no explicit photo slot found, create a main hero slot in center
        if not photo_slots:
            hw = int(psd.width * 0.6)
            hh = int(psd.height * 0.5)
            hx = (psd.width - hw) // 2
            hy = (psd.height - hh) // 2
            photo_slots.append({
                "layer_name": "Main Photo Slot",
                "slot_id": "slot_1",
                "bbox": [hx, hy, hx + hw, hy + hh],
                "width": hw,
                "height": hh,
                "kind": "pixel"
            })

        return {
            "template_id": template_id,
            "name": info["name"],
            "category": info["category"],
            "file_path": info["file_path"],
            "width": psd.width,
            "height": psd.height,
            "photo_slots": photo_slots,
            "text_slots": text_slots,
            "preview_url": f"/api/templates/{template_id}/preview"
        }

    def generate_template_output(
        self,
        template_id: str,
        output_path: str,
        photo_replacements: List[Dict[str, str]], # [{ "slot_name": ..., "photo_path": ... }]
        text_replacements: List[Dict[str, str]],  # [{ "layer_name": ..., "text": ... }]
        jpeg_quality: int = 95
    ) -> str:
        """
        Fast, high-fidelity standalone template generator (psd-tools + Pillow).
        100% offline, zero Photoshop crashes, 1-2 second generation.
        """
        info = self._index.get(template_id)
        if not info:
            raise FileNotFoundError(f"Template {template_id} not found.")

        psd_path = Path(info["file_path"])
        psd = PSDImage.open(str(psd_path))

        # 1. Base composition (fast embedded topil with fallback)
        canvas = psd.topil()
        if not canvas:
            canvas = psd.composite()
        if canvas.mode != "RGBA":
            canvas = canvas.convert("RGBA")

        # Index layers by name (case-insensitive)
        text_layer_map = {}
        pixel_layer_map = {}
        for l in psd:
            if getattr(l, "kind", None) == "type":
                text_layer_map[l.name.lower().strip()] = l
            elif getattr(l, "bbox", None):
                pixel_layer_map[l.name.lower().strip()] = l

        # 2. Apply photo replacements
        for pr in photo_replacements:
            target_name = pr.get("slot_name", "").lower().strip()
            photo_file = pr.get("photo_path")
            if not photo_file or not Path(photo_file).exists():
                continue

            target_layer = pixel_layer_map.get(target_name)
            if not target_layer and pixel_layer_map:
                # Fallback to first available large slot
                target_layer = list(pixel_layer_map.values())[0]

            if target_layer and getattr(target_layer, "bbox", None):
                bx1, by1, bx2, by2 = target_layer.bbox
                slot_w = bx2 - bx1
                slot_h = by2 - by1

                if slot_w > 50 and slot_h > 50:
                    cust_img = Image.open(photo_file)
                    cust_img = ImageOps.exif_transpose(cust_img)
                    cust_img = cust_img.convert("RGBA")

                    # Center-crop to slot aspect ratio
                    cw, ch = cust_img.size
                    slot_ratio = slot_w / slot_h
                    img_ratio = cw / ch

                    if img_ratio > slot_ratio:
                        crop_w = int(ch * slot_ratio)
                        crop_left = (cw - crop_w) // 2
                        cropped = cust_img.crop((crop_left, 0, crop_left + crop_w, ch))
                    else:
                        crop_h = int(cw / slot_ratio)
                        crop_top = max(0, min(int((ch - crop_h) * 0.06), ch - crop_h)) # preserve head
                        cropped = cust_img.crop((0, crop_top, cw, crop_top + crop_h))

                    resized = cropped.resize((slot_w, slot_h), Image.Resampling.LANCZOS)

                    # Paste onto canvas
                    canvas.paste(resized, (bx1, by1))

        # 3. Apply text replacements
        draw = ImageDraw.Draw(canvas)
        windows_font = r"C:\Windows\Fonts\georgiab.ttf"
        if not Path(windows_font).exists():
            windows_font = r"C:\Windows\Fonts\arialbd.ttf"

        for tr in text_replacements:
            tname = tr.get("layer_name", "").lower().strip()
            new_text = tr.get("text", "").strip()
            if not new_text:
                continue

            tlayer = text_layer_map.get(tname)
            if tlayer and getattr(tlayer, "bbox", None):
                tx1, ty1, tx2, ty2 = tlayer.bbox
                tb_w = tx2 - tx1
                tb_h = ty2 - ty1

                if tb_w > 0 and tb_h > 0:
                    # Clear original text area
                    draw.rectangle([tx1, ty1, tx2, ty2], fill=(255, 255, 255, 255))
                    
                    font_size = max(18, int(tb_h * 0.85))
                    try:
                        font = ImageFont.truetype(windows_font, size=font_size)
                    except Exception:
                        font = ImageFont.load_default()

                    draw.text((tx1, ty1), new_text, fill=(212, 160, 23), font=font)

        # 4. Save 300 DPI high-res print JPEG
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        final_rgb = canvas.convert("RGB")
        final_rgb.save(output_path, format="JPEG", quality=jpeg_quality, dpi=(300, 300))
        logger.info(f"Generated customized PSD output at 300 DPI: {output_path}")
        return output_path

template_service = TemplateService()
