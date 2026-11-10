import os
import json
import logging
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
from PIL import Image, ImageOps, ImageDraw, ImageFont
from psd_tools import PSDImage

from app.config.settings import get_settings

logger = logging.getLogger("template_service")

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
                logger.warning(f"Failed to load template cache, will rescan: {e}")

        self.scan_and_index()

    def scan_and_index(self):
        """Scans C:\\photodesings and indexes all PSD templates."""
        logger.info("Scanning PSD template directories...")
        root_dir = Path(r"C:\photodesings")
        if not root_dir.exists():
            logger.warning(f"Template directory '{root_dir}' does not exist.")
            return

        index = {}
        cats: Dict[str, int] = {}

        for root, dirs, files in os.walk(root_dir):
            for file in files:
                if file.lower().endswith(".psd") and not file.startswith("._"):
                    full_p = Path(root) / file
                    rel_p = full_p.relative_to(root_dir)
                    category = rel_p.parts[0] if len(rel_p.parts) > 1 else "General"
                    tid = self.get_template_id(full_p)

                    cats[category] = cats.get(category, 0) + 1
                    index[tid] = {
                        "template_id": tid,
                        "id": tid,
                        "name": full_p.stem,
                        "category": category,
                        "file_path": str(full_p),
                        "file_size": full_p.stat().st_size,
                        "width": 2400,
                        "height": 3600
                    }

        self._index = index
        self._categories = cats
        self.save_index()
        logger.info(f"Indexed {len(self._index)} PSD templates across {len(self._categories)} categories.")

    def save_index(self):
        try:
            with open(self.meta_cache_file, "w", encoding="utf-8") as f:
                json.dump({"templates": self._index, "categories": self._categories}, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save template index: {e}")

    def get_categories(self) -> List[Dict[str, Any]]:
        return [{"name": k, "count": v} for k, v in sorted(self._categories.items(), key=lambda x: -x[1])]

    def list_templates(
        self,
        category: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        items = list(self._index.values())
        if category and category != "All":
            items = [t for t in items if t["category"] == category]
        if search:
            q = search.lower().strip()
            items = [t for t in items if q in t["name"].lower() or q in t["category"].lower()]

        total = len(items)
        page = items[offset:offset + limit]

        # Add preview URLs
        for item in page:
            tid = item.get("template_id") or item.get("id", "")
            item["template_id"] = tid
            item["preview_url"] = f"/api/templates/{tid}/preview"

        return {
            "total": total,
            "category": category,
            "limit": limit,
            "offset": offset,
            "templates": page
        }

    def get_template_by_id(self, template_id: str) -> Optional[Dict[str, Any]]:
        return self._index.get(template_id)

    def get_template_preview_file(self, template_id: str) -> Path:
        """Returns or creates a fast 600px preview JPEG for the template."""
        preview_path = self.cache_dir / f"prev_{template_id}.jpg"
        if preview_path.exists() and preview_path.stat().st_size > 500:
            return preview_path

        info = self._index.get(template_id)
        if not info:
            raise FileNotFoundError(f"Template {template_id} not found.")

        psd_path = Path(info["file_path"])
        if not psd_path.exists():
            raise FileNotFoundError(f"PSD file {psd_path} missing.")

        try:
            psd = PSDImage.open(str(psd_path))
            self._index[template_id]["width"] = psd.width
            self._index[template_id]["height"] = psd.height

            img = psd.topil()
            if img:
                img.thumbnail((600, 900), Image.Resampling.BILINEAR)
                img = img.convert("RGB")
                img.save(preview_path, format="JPEG", quality=82)
                return preview_path
        except Exception as e:
            logger.warning(f"Could not load embedded preview for {psd_path.name}: {e}")

        placeholder = Image.new("RGB", (600, 900), color=(30, 41, 59))
        draw = ImageDraw.Draw(placeholder)
        draw.rectangle([20, 20, 580, 880], outline=(71, 85, 105), width=2)
        draw.text((80, 380), f"PSD TEMPLATE\n{info['name'][:24]}", fill=(255, 255, 255))
        placeholder.save(preview_path, format="JPEG", quality=80)
        return preview_path

    def _get_atomic_layers(self, group):
        """Recursively flattens all atomic layers from nested groups."""
        res = []
        for l in group:
            if l.is_group():
                res.extend(self._get_atomic_layers(l))
            else:
                res.append(l)
        return res

    def _detect_template_slots(self, psd):
        """
        Universal, accurate photo slot detector across all PSD styles:
        - Detects clipping mask pairs (Base shape + Clipped photo)
        - Detects solid blank placeholder boxes (rectangles, circles, ovals)
        - Excludes artwork, line art, flowers, poems, calendars, and stars via fill density
        - Deduplicates overlapping frames (e.g. circle fill vs border outline)
        """
        atomic = self._get_atomic_layers(psd)
        slots = []
        skip_layers = set()
        overlay_layers = []

        for i, l in enumerate(atomic):
            if l in skip_layers or getattr(l, "kind", None) == "type":
                continue

            bbox = getattr(l, "bbox", None)
            if not bbox:
                continue

            bx1, by1, bx2, by2 = bbox
            bw = bx2 - bx1
            bh = by2 - by1

            # Skip background canvas
            if l.name.lower() == "background" or (bw >= psd.width * 0.9 and bh >= psd.height * 0.9):
                continue

            # Skip narrow strips / flourish dividers
            aspect = max(bw, bh) / max(1, min(bw, bh))
            if aspect > 3.5 or bw < 160 or bh < 160:
                if bw >= 50 and bh >= 50 and l.is_visible():
                    overlay_layers.append(l)
                continue

            # Check if next layer is a clipped placeholder photo (Alt+Ctrl+G)
            clipped_layer = None
            if i + 1 < len(atomic):
                next_l = atomic[i + 1]
                if getattr(next_l, "clipping", False):
                    clipped_layer = next_l
                    skip_layers.add(next_l)

            # If layer itself is clipped and wasn't paired, skip it
            if getattr(l, "clipping", False):
                continue

            # If has clipping mask, it is 100% a photo slot!
            if clipped_layer is not None:
                slots.append({
                    "base": l,
                    "clipped": clipped_layer,
                    "bbox": bbox,
                    "width": bw,
                    "height": bh,
                    "name": l.name
                })
                continue

            # If no clipping mask, check fill density (solid photo box vs line-art clipart)
            try:
                img = l.topil()
                if not img:
                    continue
                arr = np.array(img)
                if arr.ndim == 3 and arr.shape[2] == 4:
                    a = arr[:, :, 3]
                    density = float(np.sum(a > 128)) / float(a.size)
                else:
                    density = 1.0
            except Exception:
                density = 1.0

            # Real photo boxes (rectangles, rounded frames, circles) have density >= 0.60
            # Clipart, flowers, calendars, poems have density < 0.35
            if density >= 0.60:
                slots.append({
                    "base": l,
                    "clipped": None,
                    "bbox": bbox,
                    "width": bw,
                    "height": bh,
                    "name": l.name
                })
            else:
                if bw >= 50 and bh >= 50 and l.is_visible():
                    overlay_layers.append(l)

        # Deduplicate heavily overlapping frames (e.g. circle fill vs border outline)
        clean_slots = []
        for s in slots:
            is_dup = False
            sb = s["bbox"]
            sa = (sb[2] - sb[0]) * (sb[3] - sb[1])
            for c in clean_slots:
                cb = c["bbox"]
                ca = (cb[2] - cb[0]) * (cb[3] - cb[1])
                ix1, iy1 = max(sb[0], cb[0]), max(sb[1], cb[1])
                ix2, iy2 = min(sb[2], cb[2]), min(sb[3], cb[3])
                if ix2 > ix1 and iy2 > iy1:
                    inter = (ix2 - ix1) * (iy2 - iy1)
                    iou = inter / float(sa + ca - inter)
                    if iou > 0.8:
                        is_dup = True
                        break
            if not is_dup:
                clean_slots.append(s)

        return clean_slots, overlay_layers

    def inspect_template_details(self, template_id: str) -> Dict[str, Any]:
        """Deeply inspects text layers and photo slots of a specific template."""
        info = self._index.get(template_id)
        if not info:
            raise FileNotFoundError(f"Template {template_id} not found.")

        psd_path = Path(info["file_path"])
        psd = PSDImage.open(str(psd_path))
        atomic_layers = self._get_atomic_layers(psd)

        # 1. Inspect text layers
        text_slots = []
        for l in atomic_layers:
            if getattr(l, "kind", None) == "type" and l.is_visible():
                text_content = getattr(l, "text", "") or l.name
                bbox = list(l.bbox) if getattr(l, "bbox", None) else [0, 0, 100, 50]
                text_slots.append({
                    "layer_name": l.name,
                    "original_text": text_content.strip() or l.name,
                    "bbox": bbox,
                    "font_size": int((bbox[3] - bbox[1]) * 0.8) if len(bbox) == 4 else 36
                })

        # 2. Universal slot detection
        clean_slots, _ = self._detect_template_slots(psd)
        photo_slots = []

        for idx, s in enumerate(clean_slots, 1):
            bw, bh = s["width"], s["height"]
            bx1, by1, bx2, by2 = s["bbox"]
            is_hero = (bw * bh) >= (psd.width * psd.height * 0.12)
            display_label = f"Frame {idx} ({bw} × {bh} px)"
            if is_hero:
                display_label = f"Spotlight Hero Frame ({bw} × {bh} px)"

            photo_slots.append({
                "layer_name": s["name"],
                "slot_id": f"slot_{idx}",
                "display_name": display_label,
                "bbox": [bx1, by1, bx2, by2],
                "width": bw,
                "height": bh,
                "kind": "pixel",
                "has_clipping_mask": s.get("clipped") is not None,
                "clipped_layer_name": s["clipped"].name if s.get("clipped") else None
            })

        # Fallback if no slot detected
        if not photo_slots:
            hw = int(psd.width * 0.6)
            hh = int(psd.height * 0.5)
            hx = (psd.width - hw) // 2
            hy = (psd.height - hh) // 2
            photo_slots.append({
                "layer_name": "Main Photo Slot",
                "slot_id": "slot_1",
                "display_name": f"Main Frame ({hw} × {hh} px)",
                "bbox": [hx, hy, hx + hw, hy + hh],
                "width": hw,
                "height": hh,
                "kind": "pixel",
                "has_clipping_mask": False,
                "clipped_layer_name": None
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
        High-fidelity standalone template generator (psd-tools + Pillow).
        Correctly handles clipping masks, frame shapes, and composites foreground
        decorations and typography ON TOP of customer photos without duplicating unchanged text.
        """
        info = self._index.get(template_id)
        if not info:
            raise FileNotFoundError(f"Template {template_id} not found.")

        psd_path = Path(info["file_path"])
        psd = PSDImage.open(str(psd_path))
        atomic_layers = self._get_atomic_layers(psd)

        # 1. Base canvas from fast embedded topil
        canvas = psd.topil()
        if not canvas:
            canvas = psd.composite()
        if canvas.mode != "RGBA":
            canvas = canvas.convert("RGBA")

        # 2. Universal slot detection and overlay discovery
        clean_slots, overlay_layers = self._detect_template_slots(psd)
        photo_slots_map = {s["name"].lower().strip(): s for s in clean_slots}

        # 3. Place customer photographs into slots
        for pr in photo_replacements:
            target_name = pr.get("slot_name", "").lower().strip()
            photo_file = pr.get("photo_path")
            if not photo_file or not Path(photo_file).exists():
                continue

            slot_info = photo_slots_map.get(target_name)
            if not slot_info and photo_slots_map:
                slot_info = list(photo_slots_map.values())[0]

            if slot_info:
                bx1, by1, bx2, by2 = slot_info["bbox"]
                sw, sh = slot_info["width"], slot_info["height"]

                if sw > 40 and sh > 40:
                    cust_img = Image.open(photo_file)
                    cust_img = ImageOps.exif_transpose(cust_img).convert("RGBA")

                    cw, ch = cust_img.size
                    slot_ratio = sw / sh
                    img_ratio = cw / ch

                    if img_ratio > slot_ratio:
                        crop_w = int(ch * slot_ratio)
                        c_left = (cw - crop_w) // 2
                        cropped = cust_img.crop((c_left, 0, c_left + crop_w, ch))
                    else:
                        crop_h = int(cw / slot_ratio)
                        c_top = max(0, min(int((ch - crop_h) * 0.08), ch - crop_h)) # preserve faces
                        cropped = cust_img.crop((0, c_top, cw, c_top + crop_h))

                    resized = cropped.resize((sw, sh), Image.Resampling.LANCZOS)

                    # Extract base layer alpha mask if shape has transparency (e.g. rounded corners, ovals)
                    mask = None
                    base_l = slot_info.get("base")
                    if base_l:
                        try:
                            base_img = base_l.topil()
                            if base_img and base_img.mode == "RGBA":
                                base_alpha = base_img.split()[-1]
                                extrema = base_alpha.getextrema()
                                if extrema[0] < 255:
                                    if base_alpha.size != (sw, sh):
                                        base_alpha = base_alpha.resize((sw, sh), Image.Resampling.LANCZOS)
                                    mask = base_alpha
                        except Exception:
                            pass

                    canvas.paste(resized, (bx1, by1), mask=mask)

        # 4. Re-composite foreground decorations ON TOP of photos
        for ol in overlay_layers:
            try:
                oimg = ol.topil()
                if oimg and getattr(ol, "bbox", None):
                    canvas.alpha_composite(oimg.convert("RGBA"), (ol.bbox[0], ol.bbox[1]))
            except Exception as e:
                logger.debug(f"Could not composite overlay {ol.name}: {e}")

        # 5. Handle text replacements
        # ONLY replace text if the user actually changed it from original!
        text_replacements_dict = {
            tr.get("layer_name", "").lower().strip(): tr.get("text", "").strip()
            for tr in text_replacements if tr.get("text")
        }

        windows_font = r"C:\Windows\Fonts\georgiab.ttf"
        if not Path(windows_font).exists():
            windows_font = r"C:\Windows\Fonts\arialbd.ttf"

        for l in atomic_layers:
            if getattr(l, "kind", None) == "type" and l.is_visible():
                lname = l.name.lower().strip()
                orig_text = (getattr(l, "text", "") or l.name).strip()

                if lname in text_replacements_dict:
                    new_text = text_replacements_dict[lname]
                    # ONLY redraw if new_text is different from original
                    if new_text and new_text.lower() != orig_text.lower():
                        if getattr(l, "bbox", None):
                            tx1, ty1, tx2, ty2 = l.bbox
                            tb_h = ty2 - ty1
                            tb_w = tx2 - tx1

                            if tb_w > 0 and tb_h > 0:
                                # Sample local background color around text bbox to clear old text cleanly
                                crop = canvas.crop((tx1, ty1, tx2, ty2))
                                c_arr = np.array(crop)
                                corners = [c_arr[0, 0], c_arr[0, -1], c_arr[-1, 0], c_arr[-1, -1]]
                                bg_col = tuple(np.mean(corners, axis=0).astype(int)[:3])

                                draw = ImageDraw.Draw(canvas)
                                # Clear old text with padding so zero trace of old letters remains
                                draw.rectangle([tx1 - 6, ty1 - 6, tx2 + 6, ty2 + 6], fill=bg_col)

                                # Determine contrasting text color based on background luminance
                                lum = 0.299 * bg_col[0] + 0.587 * bg_col[1] + 0.114 * bg_col[2]
                                text_color = (25, 25, 25) if lum > 140 else (250, 250, 250)

                                font_size = max(18, int(tb_h * 0.92))
                                try:
                                    font = ImageFont.truetype(windows_font, size=font_size)
                                except Exception:
                                    font = ImageFont.load_default()

                                # Measure and center the customized text within the original bounding box
                                bbox_text = draw.textbbox((0, 0), new_text, font=font)
                                tw = bbox_text[2] - bbox_text[0]
                                th = bbox_text[3] - bbox_text[1]
                                cx = (tx1 + tx2) // 2
                                cy = (ty1 + ty2) // 2
                                dx = cx - (tw // 2) - bbox_text[0]
                                dy = cy - (th // 2) - bbox_text[1]

                                draw.text((dx, dy), new_text, fill=text_color, font=font)
                # If text is unchanged: leave original typography untouched!

        # 6. Save 300 DPI high-res print JPEG
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        final_rgb = canvas.convert("RGB")
        final_rgb.save(output_path, format="JPEG", quality=jpeg_quality, dpi=(300, 300))
        logger.info(f"Generated customized PSD output at 300 DPI: {output_path}")
        return output_path

template_service = TemplateService()
