import math
import os
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
import numpy as np

logger = logging.getLogger("collage_engine")

# Standard A4 @ 300 DPI:
# 210 mm x 297 mm = 8.267 x 11.693 inches
A4_PORTRAIT_W = 2480
A4_PORTRAIT_H = 3508
A4_LANDSCAPE_W = 3508
A4_LANDSCAPE_H = 2480

FONT_MAP = {
    "arial": ["arialbd.ttf", "arial.ttf"],
    "georgia": ["georgiab.ttf", "georgia.ttf"],
    "times": ["timesbd.ttf", "times.ttf"],
    "segoeui": ["segoeuib.ttf", "segoeui.ttf"],
    "comic": ["comicbd.ttf", "comic.ttf"],
    "impact": ["impact.ttf"],
    "trebuchet": ["trebucbd.ttf", "trebuc.ttf"],
}

THEME_COLORS = {
    "white": {
        "bg_top": (255, 255, 255),
        "bg_bottom": (248, 250, 252),
        "title": (15, 23, 42),
        "name": (37, 99, 235),  # Royal Blue
        "subtitle": (100, 116, 139),
        "card_bg": (255, 255, 255),
        "border": (226, 232, 240),
        "accent": (59, 130, 246),
    },
    "gold_luxury": {
        "bg_top": (15, 23, 42),      # Deep Midnight Slate
        "bg_bottom": (10, 15, 30),
        "title": (245, 158, 11),     # Amber Gold
        "name": (251, 191, 36),      # Radiant Gold
        "subtitle": (203, 213, 225), # Soft Silver
        "card_bg": (30, 41, 59),
        "border": (217, 119, 6),     # Warm Gold Border
        "accent": (245, 158, 11),
    },
    "midnight_blue": {
        "bg_top": (10, 25, 47),
        "bg_bottom": (5, 15, 30),
        "title": (56, 189, 248),     # Electric Sky
        "name": (255, 255, 255),
        "subtitle": (148, 163, 184),
        "card_bg": (15, 30, 60),
        "border": (56, 189, 248),
        "accent": (14, 165, 233),
    },
    "pastel_pink": {
        "bg_top": (255, 241, 242),   # Soft Rose
        "bg_bottom": (253, 232, 240),
        "title": (225, 29, 72),      # Crimson Rose
        "name": (190, 18, 60),
        "subtitle": (136, 19, 55),
        "card_bg": (255, 255, 255),
        "border": (254, 205, 211),
        "accent": (244, 63, 94),
    },
    "sky_celebration": {
        "bg_top": (240, 249, 255),   # Soft Sky
        "bg_bottom": (224, 242, 254),
        "title": (3, 105, 161),
        "name": (2, 132, 199),
        "subtitle": (71, 85, 105),
        "card_bg": (255, 255, 255),
        "border": (186, 230, 253),
        "accent": (14, 165, 233),
    },
    "festive_party": {
        "bg_top": (254, 242, 242),
        "bg_bottom": (238, 242, 255),
        "title": (220, 38, 38),      # Party Red
        "name": (79, 70, 229),       # Indigo
        "subtitle": (71, 85, 105),
        "card_bg": (255, 255, 255),
        "border": (251, 191, 36),    # Gold Yellow
        "accent": (236, 72, 153),
    }
}


class BirthdayCollageEngine:
    def __init__(self):
        self.windows_fonts_dir = Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts"

    def get_font(self, font_name: str, size: int) -> ImageFont.ImageFont:
        """Loads TrueType font with graceful system fallback."""
        candidates = FONT_MAP.get(font_name.lower(), ["arialbd.ttf", "arial.ttf"])
        for c in candidates:
            p = self.windows_fonts_dir / c
            if p.exists():
                try:
                    return ImageFont.truetype(str(p), size)
                except Exception:
                    pass
        try:
            return ImageFont.truetype(str(self.windows_fonts_dir / "arial.ttf"), size)
        except Exception:
            return ImageFont.load_default()

    def calculate_slots(
        self,
        count: int,
        content_box: Tuple[int, int, int, int], # (x, y, w, h)
        template_id: str = "hero_celebration",
        spacing: int = 24
    ) -> List[Tuple[int, int, int, int]]:
        """
        Calculates exact rectangular slot coordinates (x, y, w, h)
        for 2 to 20 photographs based on the template layout.
        """
        bx, by, bw, bh = content_box
        slots: List[Tuple[int, int, int, int]] = []
        count = max(2, min(20, count))

        if template_id == "hero_celebration":
            slots = self._layout_hero(count, bx, by, bw, bh, spacing)
        elif template_id == "polaroid":
            slots = self._layout_polaroid(count, bx, by, bw, bh, spacing)
        else:
            # balanced_mosaic / golden_luxury / playful_party / default
            slots = self._layout_mosaic(count, bx, by, bw, bh, spacing)

        return slots

    def _layout_hero(self, count: int, x: int, y: int, w: int, h: int, spacing: int) -> List[Tuple[int, int, int, int]]:
        """Hero celebration layout: 1 prominent Hero slot + (count - 1) supporting slots."""
        slots = []
        is_portrait = h >= w

        if count == 2:
            if is_portrait:
                # Top Hero (58%), Bottom photo (42%)
                top_h = int((h - spacing) * 0.58)
                bot_h = h - spacing - top_h
                slots.append((x, y, w, top_h))
                slots.append((x, y + top_h + spacing, w, bot_h))
            else:
                # Left Hero (58% width), Right photo (42% width)
                hw = int((w - spacing) * 0.58)
                sw = w - spacing - hw
                slots.append((x, y, hw, h))
                slots.append((x + hw + spacing, y, sw, h))
            return slots

        if count == 3:
            if is_portrait:
                # Top Hero banner (55%), Bottom 2 photos side-by-side
                top_h = int((h - spacing) * 0.55)
                bot_h = h - spacing - top_h
                sw = (w - spacing) // 2
                slots.append((x, y, w, top_h))
                slots.append((x, y + top_h + spacing, sw, bot_h))
                slots.append((x + sw + spacing, y + top_h + spacing, w - sw - spacing, bot_h))
            else:
                # Left Hero (56%), Right 2 stacked
                hw = int((w - spacing) * 0.56)
                sw = w - spacing - hw
                sh = (h - spacing) // 2
                slots.append((x, y, hw, h))
                slots.append((x + hw + spacing, y, sw, sh))
                slots.append((x + hw + spacing, y + sh + spacing, sw, h - sh - spacing))
            return slots

        if count == 4:
            if is_portrait:
                # Top Hero banner (50%), Bottom 3 photos side-by-side
                top_h = int((h - spacing) * 0.50)
                bot_h = h - spacing - top_h
                sw = (w - 2 * spacing) // 3
                slots.append((x, y, w, top_h))
                for i in range(3):
                    cur_x = x + i * (sw + spacing)
                    cur_w = sw if i < 2 else (x + w - cur_x)
                    slots.append((cur_x, y + top_h + spacing, cur_w, bot_h))
            else:
                # Left Hero (52%), Right 3 stacked
                hw = int((w - spacing) * 0.52)
                sw = w - spacing - hw
                sh = (h - 2 * spacing) // 3
                slots.append((x, y, hw, h))
                for i in range(3):
                    cur_y = y + i * (sh + spacing)
                    cur_h = sh if i < 2 else (y + h - cur_y)
                    slots.append((x + hw + spacing, cur_y, sw, cur_h))
            return slots

        if count == 5:
            if is_portrait:
                # Top Hero banner (46%), Bottom 2x2 grid
                top_h = int((h - spacing) * 0.46)
                bot_h = h - spacing - top_h
                cw = (w - spacing) // 2
                rh = (bot_h - spacing) // 2
                slots.append((x, y, w, top_h))
                slots.append((x, y + top_h + spacing, cw, rh))
                slots.append((x + cw + spacing, y + top_h + spacing, w - cw - spacing, rh))
                slots.append((x, y + top_h + spacing + rh + spacing, cw, bot_h - rh - spacing))
                slots.append((x + cw + spacing, y + top_h + spacing + rh + spacing, w - cw - spacing, bot_h - rh - spacing))
            else:
                # Left Hero (50%), Right 2x2 grid
                hw = (w - spacing) // 2
                rw = w - spacing - hw
                cw = (rw - spacing) // 2
                rh = (h - spacing) // 2
                slots.append((x, y, hw, h))
                slots.append((x + hw + spacing, y, cw, rh))
                slots.append((x + hw + spacing + cw + spacing, y, rw - cw - spacing, rh))
                slots.append((x + hw + spacing, y + rh + spacing, cw, h - rh - spacing))
                slots.append((x + hw + spacing + cw + spacing, y + rh + spacing, rw - cw - spacing, h - rh - spacing))
            return slots

        if 6 <= count <= 8:
            # Hero takes top-left or top-center (approx 50% width and height)
            # Remaining photos arrange around
            cols = 3
            rows = 3
            cw = (w - (cols - 1) * spacing) // cols
            rh = (h - (rows - 1) * spacing) // rows

            # Hero occupies 2 cols x 2 rows
            hero_w = 2 * cw + spacing
            hero_h = 2 * rh + spacing
            slots.append((x, y, hero_w, hero_h))

            # Available 1x1 positions:
            # (row 0, col 2), (row 1, col 2), (row 2, col 0), (row 2, col 1), (row 2, col 2) -> 5 slots (total 6)
            pos_list = [
                (2, 0), (2, 1), # col 2, row 0 and 1
                (0, 2), (1, 2), (2, 2) # row 2, col 0, 1, 2
            ]
            rem_needed = count - 1
            for i in range(rem_needed):
                c_idx, r_idx = pos_list[i % len(pos_list)]
                cur_x = x + c_idx * (cw + spacing)
                cur_y = y + r_idx * (rh + spacing)
                slots.append((cur_x, cur_y, cw, rh))
            return slots

        # For 9 to 20 photos:
        # Structured Grid with Hero occupying a 2x2 block in the center or top-left
        cols = 4 if count <= 14 else 5
        rows = 4 if count <= 12 else 5
        cw = (w - (cols - 1) * spacing) // cols
        rh = (h - (rows - 1) * spacing) // rows

        # Place Hero at (col 1, row 1) or (col 0, row 0)
        hero_w = 2 * cw + spacing
        hero_h = 2 * rh + spacing
        slots.append((x, y, hero_w, hero_h))

        # Fill remaining grid cells until count is met
        placed = 1
        for r_idx in range(rows):
            for c_idx in range(cols):
                if placed >= count:
                    break
                # Skip cells covered by hero (0,0), (0,1), (1,0), (1,1)
                if c_idx < 2 and r_idx < 2:
                    continue
                cur_x = x + c_idx * (cw + spacing)
                cur_y = y + r_idx * (rh + spacing)
                slots.append((cur_x, cur_y, cw, rh))
                placed += 1
            if placed >= count:
                break

        return slots

    def _layout_mosaic(self, count: int, x: int, y: int, w: int, h: int, spacing: int) -> List[Tuple[int, int, int, int]]:
        """Balanced mosaic layout for 2 to 20 photos."""
        slots = []

        if count == 2:
            sw = (w - spacing) // 2
            slots.append((x, y, sw, h))
            slots.append((x + sw + spacing, y, w - sw - spacing, h))
            return slots

        if count == 3:
            # 1 wide top, 2 below
            top_h = int((h - spacing) * 0.52)
            bot_h = h - spacing - top_h
            bot_w = (w - spacing) // 2
            slots.append((x, y, w, top_h))
            slots.append((x, y + top_h + spacing, bot_w, bot_h))
            slots.append((x + bot_w + spacing, y + top_h + spacing, w - bot_w - spacing, bot_h))
            return slots

        if count == 4:
            # 2x2 grid
            cw = (w - spacing) // 2
            rh = (h - spacing) // 2
            for r in range(2):
                for c in range(2):
                    slots.append((x + c * (cw + spacing), y + r * (rh + spacing), cw, rh))
            return slots

        if count == 5:
            # Row 1: 2 photos, Row 2: 3 photos
            rh = (h - spacing) // 2
            w2 = (w - spacing) // 2
            slots.append((x, y, w2, rh))
            slots.append((x + w2 + spacing, y, w - w2 - spacing, rh))

            w3 = (w - 2 * spacing) // 3
            slots.append((x, y + rh + spacing, w3, h - rh - spacing))
            slots.append((x + w3 + spacing, y + rh + spacing, w3, h - rh - spacing))
            slots.append((x + 2 * (w3 + spacing), y + rh + spacing, w - 2 * (w3 + spacing), h - rh - spacing))
            return slots

        if count == 6:
            # 2 cols x 3 rows (portrait) or 3 cols x 2 rows
            cols, rows = (2, 3) if h > w else (3, 2)
            cw = (w - (cols - 1) * spacing) // cols
            rh = (h - (rows - 1) * spacing) // rows
            for r in range(rows):
                for c in range(cols):
                    slots.append((x + c * (cw + spacing), y + r * (rh + spacing), cw, rh))
            return slots

        if count == 7:
            # 1 wide top hero + 2 rows of 3 photos
            top_h = int((h - 2 * spacing) * 0.38)
            rem_h = h - 2 * spacing - top_h
            rh = rem_h // 2
            cw = (w - 2 * spacing) // 3
            slots.append((x, y, w, top_h))
            for r in range(2):
                for c in range(3):
                    slots.append((x + c * (cw + spacing), y + top_h + spacing + r * (rh + spacing), cw, rh))
            return slots

        if count == 8:
            cols, rows = (2, 4) if h > w else (4, 2)
            cw = (w - (cols - 1) * spacing) // cols
            rh = (h - (rows - 1) * spacing) // rows
            for r in range(rows):
                for c in range(cols):
                    slots.append((x + c * (cw + spacing), y + r * (rh + spacing), cw, rh))
            return slots

        if count == 9:
            # 3x3 grid
            cw = (w - 2 * spacing) // 3
            rh = (h - 2 * spacing) // 3
            for r in range(3):
                for c in range(3):
                    slots.append((x + c * (cw + spacing), y + r * (rh + spacing), cw, rh))
            return slots

        if count == 10:
            # 2 rows of 5 or 5 rows of 2
            cols, rows = (2, 5) if h > w else (5, 2)
            cw = (w - (cols - 1) * spacing) // cols
            rh = (h - (rows - 1) * spacing) // rows
            for r in range(rows):
                for c in range(cols):
                    slots.append((x + c * (cw + spacing), y + r * (rh + spacing), cw, rh))
            return slots

        # Generic auto-grid for 11 to 20 photos
        cols = 3 if count <= 12 else 4
        if count > 16:
            cols = 4 if h > w else 5
        rows = math.ceil(count / cols)

        cw = (w - (cols - 1) * spacing) // cols
        rh = (h - (rows - 1) * spacing) // rows

        placed = 0
        for r in range(rows):
            # If last row has fewer items, center them or expand
            remaining = count - placed
            row_items = min(cols, remaining)
            row_x = x
            if row_items < cols:
                row_x = x + (w - (row_items * cw + (row_items - 1) * spacing)) // 2

            for c in range(row_items):
                slots.append((row_x + c * (cw + spacing), y + r * (rh + spacing), cw, rh))
                placed += 1
                if placed >= count:
                    break
            if placed >= count:
                break

        return slots

    def _layout_polaroid(self, count: int, x: int, y: int, w: int, h: int, spacing: int) -> List[Tuple[int, int, int, int]]:
        """Polaroid style cards layout with extra bottom padding for card effect."""
        return self._layout_mosaic(count, x, y, w, h, spacing + 12)

    def fit_and_render_photo(
        self,
        photo_path: str,
        target_box: Tuple[int, int, int, int],
        canvas: Image.Image,
        rounded_radius: int = 16,
        border_width: int = 6,
        border_color: Tuple[int, int, int] = (255, 255, 255),
        shadow: bool = True
    ) -> None:
        """
        Crops photo center-weighted to target aspect ratio, applies rounded corners,
        adds border stroke & shadow, and composites onto canvas.
        """
        bx, by, bw, bh = target_box
        if bw <= 0 or bh <= 0:
            return

        try:
            pil_img = Image.open(photo_path)
            pil_img = ImageOps.exif_transpose(pil_img)
            pil_img = pil_img.convert("RGB")
        except Exception as e:
            logger.warning(f"Could not load image {photo_path}: {e}")
            return

        # Smart center-crop to slot aspect ratio
        img_w, img_h = pil_img.size
        slot_ratio = bw / bh
        img_ratio = img_w / img_h

        if img_ratio > slot_ratio:
            crop_w = int(img_h * slot_ratio)
            left = (img_w - crop_w) // 2
            cropped = pil_img.crop((left, 0, left + crop_w, img_h))
        else:
            crop_h = int(img_w / slot_ratio)
            # Anchor near the top (5% margin) to preserve head, hair, and face in portraits
            top = max(0, min(int((img_h - crop_h) * 0.05), img_h - crop_h))
            cropped = pil_img.crop((0, top, img_w, top + crop_h))

        # Resize to slot dimensions
        resized = cropped.resize((bw, bh), Image.Resampling.LANCZOS)

        # Build card with rounded corners and border
        card = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        card.paste(resized, (0, 0))

        # Alpha mask for rounded corners
        mask = Image.new("L", (bw, bh), 0)
        draw_mask = ImageDraw.Draw(mask)
        draw_mask.rounded_rectangle([0, 0, bw, bh], radius=rounded_radius, fill=255)

        # Border outline
        if border_width > 0:
            border_overlay = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
            draw_border = ImageDraw.Draw(border_overlay)
            for i in range(border_width):
                draw_border.rounded_rectangle(
                    [i, i, bw - 1 - i, bh - 1 - i],
                    radius=max(0, rounded_radius - i),
                    outline=border_color + (255,)
                )
            card = Image.alpha_composite(card, border_overlay)

        # Soft shadow simulation
        if shadow:
            shadow_offset = 6
            shadow_box = (bx + shadow_offset, by + shadow_offset)
            shadow_mask = Image.new("RGBA", (bw, bh), (0, 0, 0, 45))
            canvas.paste(shadow_mask, shadow_box, mask=mask)

        # Paste onto canvas
        canvas.paste(card, (bx, by), mask=mask)

    def draw_confetti(self, draw: ImageDraw.ImageDraw, w: int, h: int, count: int = 120) -> None:
        """Renders festive confetti specks and streamers across margins."""
        np.random.seed(42)
        colors = [
            (244, 63, 94, 180),   # Rose
            (245, 158, 11, 180),  # Amber gold
            (14, 165, 233, 180),  # Sky blue
            (168, 85, 247, 180),  # Purple
            (34, 197, 94, 180),   # Emerald
            (236, 72, 153, 180),  # Pink
        ]
        for _ in range(count):
            cx = int(np.random.randint(40, w - 40))
            cy = int(np.random.randint(30, h - 30))
            # Keep mostly in margins / header / footer
            if 600 < cy < h - 400 and 300 < cx < w - 300:
                continue
            col = colors[np.random.randint(0, len(colors))]
            sz = int(np.random.randint(8, 20))
            shape = np.random.choice(["circle", "rect", "diamond"])
            if shape == "circle":
                draw.ellipse([cx, cy, cx + sz, cy + sz], fill=col[:3])
            elif shape == "rect":
                draw.rectangle([cx, cy, cx + sz, cy + sz // 2], fill=col[:3])
            else:
                draw.polygon([(cx, cy - sz), (cx + sz, cy), (cx, cy + sz), (cx - sz, cy)], fill=col[:3])

    def generate_birthday_collage(
        self,
        photo_paths: List[str],
        output_path: str,
        orientation: str = "portrait",
        template_id: str = "hero_celebration",
        theme_id: str = "gold_luxury",
        custom_bg_color: Optional[str] = None,
        title: str = "HAPPY BIRTHDAY",
        name: str = "CELEBRANT",
        subtitle: str = "Wishing you joy, love & happiness on your special day!",
        font_family: str = "georgia",
        font_size_scale: float = 1.0,
        show_decorations: bool = True,
        rounded_corners: bool = True,
        border_width: int = 8
    ) -> str:
        """
        Generates complete A4 print-ready Birthday Photo Collage at 300 DPI.
        """
        count = len(photo_paths)
        if count < 2:
            raise ValueError("Collage requires at least 2 photographs.")
        photo_paths = photo_paths[:20]  # Cap at 20

        is_portrait = orientation.lower() != "landscape"
        canvas_w = A4_PORTRAIT_W if is_portrait else A4_LANDSCAPE_W
        canvas_h = A4_PORTRAIT_H if is_portrait else A4_LANDSCAPE_H

        # Theme color selection
        theme = THEME_COLORS.get(theme_id, THEME_COLORS["gold_luxury"]).copy()
        if custom_bg_color:
            from app.image_processing.background_remover import hex_to_rgb
            theme["bg_top"] = hex_to_rgb(custom_bg_color)
            theme["bg_bottom"] = hex_to_rgb(custom_bg_color)

        # 1. Canvas creation with vertical gradient or solid
        canvas = Image.new("RGB", (canvas_w, canvas_h), theme["bg_top"])
        if theme["bg_top"] != theme["bg_bottom"]:
            # Vertical gradient background
            base = Image.new("RGB", (canvas_w, canvas_h))
            top_col = np.array(theme["bg_top"], dtype=float)
            bot_col = np.array(theme["bg_bottom"], dtype=float)
            alphas = np.linspace(0, 1, canvas_h).reshape((canvas_h, 1, 1))
            gradient = (top_col * (1 - alphas) + bot_col * alphas).astype(np.uint8)
            gradient = np.tile(gradient, (1, canvas_w, 1))
            canvas = Image.fromarray(gradient)

        draw = ImageDraw.Draw(canvas)

        # 2. Outer decorative poster border
        margin = 60
        border_color = theme["border"]
        draw.rectangle([margin, margin, canvas_w - margin, canvas_h - margin], outline=border_color, width=4)
        draw.rectangle([margin + 12, margin + 12, canvas_w - margin - 12, canvas_h - margin - 12], outline=border_color, width=1)

        # 3. Header Typography Region
        header_top = margin + 40
        header_h = 420 if is_portrait else 340

        # Title: "HAPPY BIRTHDAY"
        title_font_size = int(64 * font_size_scale)
        title_font = self.get_font(font_family, title_font_size)
        title_bbox = draw.textbbox((0, 0), title.upper(), font=title_font)
        title_w = title_bbox[2] - title_bbox[0]
        title_x = (canvas_w - title_w) // 2
        title_y = header_top + 10

        # Subtle gold/accent banner line
        draw.text((title_x, title_y), title.upper(), fill=theme["title"], font=title_font)

        # Celebrant Name: e.g. "PRIYA"
        name_font_size = int(108 * font_size_scale)
        name_font = self.get_font(font_family, name_font_size)
        name_bbox = draw.textbbox((0, 0), name.upper(), font=name_font)
        name_w = name_bbox[2] - name_bbox[0]
        name_x = (canvas_w - name_w) // 2
        name_y = title_y + (title_bbox[3] - title_bbox[1]) + 20

        # Draw subtle text shadow for luxury depth
        draw.text((name_x + 3, name_y + 3), name.upper(), fill=(0, 0, 0, 100), font=name_font)
        draw.text((name_x, name_y), name.upper(), fill=theme["name"], font=name_font)

        # Subtitle / message
        sub_font_size = int(36 * font_size_scale)
        sub_font = self.get_font("segoeui" if font_family == "impact" else font_family, sub_font_size)
        sub_bbox = draw.textbbox((0, 0), subtitle, font=sub_font)
        sub_w = sub_bbox[2] - sub_bbox[0]
        sub_x = (canvas_w - sub_w) // 2
        sub_y = name_y + (name_bbox[3] - name_bbox[1]) + 25
        draw.text((sub_x, sub_y), subtitle, fill=theme["subtitle"], font=sub_font)

        # Decorative separator rule
        rule_y = sub_y + (sub_bbox[3] - sub_bbox[1]) + 30
        rule_w = min(1200, canvas_w - 200)
        rule_x = (canvas_w - rule_w) // 2
        draw.line([rule_x, rule_y, rule_x + rule_w, rule_y], fill=theme["border"], width=2)
        # Small diamond in middle
        mid_x = canvas_w // 2
        draw.polygon([(mid_x, rule_y - 6), (mid_x + 6, rule_y), (mid_x, rule_y + 6), (mid_x - 6, rule_y)], fill=theme["title"])

        # 4. Confetti decorations if enabled
        if show_decorations:
            self.draw_confetti(draw, canvas_w, canvas_h)

        # 5. Photo Grid Region
        content_top = rule_y + 40
        footer_h = 100
        content_bottom = canvas_h - margin - footer_h
        content_left = margin + 35
        content_w = canvas_w - 2 * content_left
        content_h = content_bottom - content_top

        # Calculate slot rectangles
        spacing = 26 if count <= 8 else (20 if count <= 14 else 16)
        slots = self.calculate_slots(
            count=count,
            content_box=(content_left, content_top, content_w, content_h),
            template_id=template_id,
            spacing=spacing
        )

        # 6. Render each photograph into its slot
        card_radius = 20 if rounded_corners else 0
        card_border_col = theme["border"] if theme_id in ["gold_luxury", "midnight_blue"] else (255, 255, 255)

        for idx, p_path in enumerate(photo_paths):
            if idx >= len(slots):
                break
            slot_box = slots[idx]
            # Hero slot (idx == 0 in hero template) gets thicker gold/accent border
            is_hero = (idx == 0 and template_id == "hero_celebration")
            slot_border_w = border_width + 4 if is_hero else border_width
            slot_border_col = theme["title"] if is_hero else card_border_col

            self.fit_and_render_photo(
                photo_path=p_path,
                target_box=slot_box,
                canvas=canvas,
                rounded_radius=card_radius,
                border_width=slot_border_w,
                border_color=slot_border_col,
                shadow=True
            )

        # 7. Footer Stamp / PJK Xerox studio credit
        footer_y = canvas_h - margin - 50
        footer_text = "Designed with Love • PJK Xerox Studio Print Output"
        footer_font = self.get_font("segoeui", 28)
        fb = draw.textbbox((0, 0), footer_text, font=footer_font)
        fw = fb[2] - fb[0]
        draw.text(((canvas_w - fw) // 2, footer_y), footer_text, fill=theme["subtitle"], font=footer_font)

        # 8. Save high-resolution A4 JPEG
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output_path, format="JPEG", quality=96, dpi=(300, 300))
        logger.info(f"Generated Birthday Collage A4 @ 300 DPI ({canvas_w}x{canvas_h}): {output_path}")

        return output_path


birthday_collage_engine = BirthdayCollageEngine()

