import io
import logging
from pathlib import Path
from typing import Tuple, Optional
from PIL import Image, ImageOps
import numpy as np

logger = logging.getLogger("background_remover")

_rembg_session = None

def get_rembg_session():
    """Lazy loads and caches the rembg session for fast subsequent runs."""
    global _rembg_session
    if _rembg_session is None:
        try:
            import rembg
            logger.info("Initializing local rembg AI session (u2net)...")
            _rembg_session = rembg.new_session("u2net")
            logger.info("rembg AI session initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize rembg session: {e}")
            raise e
    return _rembg_session

def hex_to_rgb(hex_str: str) -> Tuple[int, int, int]:
    """Converts a hex color string (#0080FF or 0080FF) to an (R, G, B) tuple."""
    hex_clean = hex_str.strip().lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    if len(hex_clean) != 6:
        # Default to PJK Blue
        return (0, 128, 255)
    return tuple(int(hex_clean[i:i+2], 16) for i in (0, 2, 4))

class BackgroundRemoverService:
    def __init__(self):
        pass

    def replace_background(
        self,
        input_image_path: str,
        output_image_path: str,
        bg_color_hex: Optional[str] = "#0080FF",
        quality: int = 95,
        dpi: int = 300
    ) -> str:
        """
        Removes image background and replaces it with a clean solid color,
        preserving fine hair edges and person identity with high fidelity.
        """
        import rembg

        # Open and orient properly
        pil_img = Image.open(input_image_path)
        pil_img = ImageOps.exif_transpose(pil_img)

        # If user selected original background (empty or None or 'original')
        if not bg_color_hex or bg_color_hex.lower() in ("original", "none", "keep"):
            pil_img = pil_img.convert("RGB")
            Path(output_image_path).parent.mkdir(parents=True, exist_ok=True)
            pil_img.save(output_image_path, format="JPEG", quality=quality, dpi=(dpi, dpi))
            return output_image_path

        session = get_rembg_session()

        # Remove background to get RGBA with transparent background
        # alpha_matting improves hair edges
        rgba_img = rembg.remove(
            pil_img,
            session=session,
            alpha_matting=True,
            alpha_matting_foreground_threshold=240,
            alpha_matting_background_threshold=10,
            alpha_matting_erode_size=5
        )

        # Parse target background color
        r, g, b = hex_to_rgb(bg_color_hex)
        solid_bg = Image.new("RGBA", rgba_img.size, (r, g, b, 255))

        # Composite person over the solid background
        composited = Image.alpha_composite(solid_bg, rgba_img)
        final_rgb = composited.convert("RGB")

        # Save result with physical DPI
        Path(output_image_path).parent.mkdir(parents=True, exist_ok=True)
        final_rgb.save(output_image_path, format="JPEG", quality=quality, dpi=(dpi, dpi))
        return output_image_path


background_remover = BackgroundRemoverService()

