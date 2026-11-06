import asyncio
import json
import logging
import os
import subprocess
import time
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from PIL import Image, ImageOps, ImageEnhance, ImageDraw
import numpy as np
import cv2

from app.config.settings import get_settings

logger = logging.getLogger("photoshop_service")

# Lock to ensure only one Photoshop execution runs at any time
_ps_lock = asyncio.Lock()

class PhotoshopService:
    def __init__(self):
        self.settings = get_settings()

    def get_photoshop_exe(self) -> Optional[Path]:
        """Finds or validates the Photoshop executable path."""
        configured = Path(self.settings.photoshop_exe_path)
        if configured.exists() and configured.name.lower() == "photoshop.exe":
            return configured

        # Known search paths on Windows
        common_paths = [
            Path(r"C:\Program Files\Adobe\Adobe Photoshop CS6 (x64)\Photoshop.exe"),
            Path(r"C:\Program Files\Adobe\Adobe Photoshop CS6\Photoshop.exe"),
            Path(r"C:\Program Files\Adobe\Adobe Photoshop 2025\Photoshop.exe"),
            Path(r"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe"),
            Path(r"C:\Program Files\Adobe\Adobe Photoshop 2023\Photoshop.exe"),
            Path(r"C:\Program Files\Adobe\Adobe Photoshop 2022\Photoshop.exe"),
            Path(r"C:\Program Files (x86)\Adobe\Adobe Photoshop CS6\Photoshop.exe"),
            Path(r"C:\Program Files (x86)\Adobe\Adobe Photoshop CS5\Photoshop.exe"),
        ]
        for p in common_paths:
            if p.exists():
                return p
        return None

    def is_photoshop_running(self) -> bool:
        """Checks if a Photoshop process is currently running."""
        try:
            output = subprocess.check_output(
                ["tasklist", "/FI", "IMAGENAME eq Photoshop.exe", "/FO", "CSV", "/NH"],
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
            ).decode("latin1", errors="ignore")
            return "photoshop.exe" in output.lower()
        except Exception as e:
            logger.warning(f"Error checking if Photoshop is running: {e}")
            return False

    def check_skinfiner_installed(self) -> Tuple[bool, str]:
        """Checks if the SkinFiner Photoshop plugin (.8bf) is installed."""
        ps_exe = self.get_photoshop_exe()
        search_dirs = [
            Path(r"C:\Program Files\Common Files\Adobe\Plug-Ins"),
            Path(r"C:\Program Files (x86)\Common Files\Adobe\Plug-Ins"),
        ]
        if ps_exe:
            ps_plugins = ps_exe.parent / "Plug-ins"
            if ps_plugins.exists():
                search_dirs.append(ps_plugins)

        for d in search_dirs:
            if d.exists():
                try:
                    for f in d.rglob("*.8b*"):
                        if "skinfiner" in f.name.lower():
                            return True, str(f)
                except Exception:
                    pass

        return False, "SkinFiner plugin (.8bf) was not found in Photoshop Plug-ins or Common Files."

    def check_action_file(self) -> Tuple[bool, str]:
        """Checks if the configured action file exists."""
        act_path = Path(self.settings.action_file_path)
        if act_path.exists():
            return True, str(act_path)
        
        # Fallback to project root or photoshop/actions
        root_atn = Path(__file__).resolve().parent.parent.parent.parent / "PJK.atn"
        if root_atn.exists():
            return True, str(root_atn)

        sub_atn = Path(__file__).resolve().parent.parent.parent.parent / "photoshop" / "actions" / "PJK.atn"
        if sub_atn.exists():
            return True, str(sub_atn)

        return False, f"Action file not found at {act_path}"

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive diagnostic status for Photoshop & Plugins."""
        ps_exe = self.get_photoshop_exe()
        ps_running = self.is_photoshop_running()
        skinfiner_ok, skinfiner_info = self.check_skinfiner_installed()
        act_ok, act_info = self.check_action_file()

        return {
            "photoshop_installed": ps_exe is not None,
            "photoshop_path": str(ps_exe) if ps_exe else None,
            "photoshop_running": ps_running,
            "skinfiner_installed": skinfiner_ok,
            "skinfiner_info": skinfiner_info,
            "action_file_exists": act_ok,
            "action_file_path": act_info,
            "action_set_name": self.settings.action_set_name,
            "action_name": self.settings.action_name,
            "auto_fallback_enhancement": self.settings.auto_fallback_enhancement
        }

    def normalize_image_for_photoshop(self, input_path: str, normalized_path: str) -> None:
        """
        Ensures input image has standard RGB baseline JPEG encoding and valid orientation,
        preventing Photoshop CS6 'incorrect open options' errors.
        """
        img = Image.open(input_path)
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        img.save(normalized_path, format="JPEG", quality=98, dpi=(300, 300))

    def native_studio_enhancement(
        self,
        input_path: str,
        output_path: str,
        target_width_mm: float = 35.0,
        target_height_mm: float = 45.0,
        dpi: int = 300,
        add_stroke: bool = True
    ) -> str:
        """
        Printing-shop quality built-in passport photo processor:
        - Exact millimeter-to-pixel sizing at target DPI (35x45 mm @ 300 DPI = 413 x 531 px)
        - Aspect ratio preservation with smart passport framing
        - Gentle edge-preserving skin softening (Bilateral filter)
        - Skin tone and contrast enhancement
        - Optional border stroke
        """
        # Calculate target dimensions in pixels
        target_w = int(round((target_width_mm / 25.4) * dpi))
        target_h = int(round((target_height_mm / 25.4) * dpi))

        # Open and orient
        pil_img = Image.open(input_path)
        pil_img = ImageOps.exif_transpose(pil_img)
        pil_img = pil_img.convert("RGB")

        # Smart crop to passport aspect ratio (target_w : target_h)
        curr_w, curr_h = pil_img.size
        target_ratio = target_w / target_h
        curr_ratio = curr_w / curr_h

        if curr_ratio > target_ratio:
            # Image is wider than passport: crop left & right
            new_w = int(curr_h * target_ratio)
            left = (curr_w - new_w) // 2
            box = (left, 0, left + new_w, curr_h)
            cropped = pil_img.crop(box)
        else:
            # Image is taller than passport: crop slightly more from bottom to keep head centered
            new_h = int(curr_w / target_ratio)
            top = max(0, int((curr_h - new_h) * 0.25))  # Keep head towards top
            box = (0, top, curr_w, top + new_h)
            cropped = pil_img.crop(box)

        # High-quality resize to target passport resolution
        resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

        # Apply subtle studio skin softening (mimicking SkinFiner smoothing without blurring eyes/hair)
        np_img = np.array(resized)
        # Convert RGB to BGR for OpenCV
        bgr = cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
        # Bilateral filter smooths skin while retaining crisp edges
        smoothed_bgr = cv2.bilateralFilter(bgr, d=7, sigmaColor=40, sigmaSpace=40)
        # Blend 70% smoothed + 30% original to keep natural skin pores
        blended_bgr = cv2.addWeighted(smoothed_bgr, 0.70, bgr, 0.30, 0)
        # Convert back to RGB
        enhanced_rgb = cv2.cvtColor(blended_bgr, cv2.COLOR_BGR2RGB)
        result_pil = Image.fromarray(enhanced_rgb)

        # Subtle contrast and color vibrance optimization
        contrast_enhancer = ImageEnhance.Contrast(result_pil)
        result_pil = contrast_enhancer.enhance(1.05)
        color_enhancer = ImageEnhance.Color(result_pil)
        result_pil = color_enhancer.enhance(1.04)

        # Optional crisp border stroke
        if add_stroke and self.settings.border_stroke_width_px > 0:
            draw = ImageDraw.Draw(result_pil)
            border_w = self.settings.border_stroke_width_px
            border_col = self.settings.border_stroke_color
            for i in range(border_w):
                draw.rectangle([i, i, target_w - 1 - i, target_h - 1 - i], outline=border_col)

        # Save with physical 300 DPI metadata
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        result_pil.save(output_path, format="JPEG", quality=self.settings.output_jpeg_quality, dpi=(dpi, dpi))
        return output_path

    async def execute_passport_action(
        self,
        input_image_path: str,
        output_image_path: str,
        action_name: Optional[str] = None,
        action_set: Optional[str] = None,
        timeout_seconds: int = 45
    ) -> Dict[str, Any]:
        """
        Executes the Photoshop action on the given photograph with full concurrency control,
        path safety, error trapping, and automatic fallback if required.
        """
        action_name = action_name or self.settings.action_name
        action_set = action_set or self.settings.action_set_name
        ps_exe = self.get_photoshop_exe()

        async with _ps_lock:
            # 1. Check if Photoshop is available
            if not ps_exe or not ps_exe.exists():
                msg = f"Photoshop executable not found at '{ps_exe}'."
                logger.warning(msg)
                if self.settings.auto_fallback_enhancement:
                    logger.info("Executing built-in studio passport enhancement fallback...")
                    self.native_studio_enhancement(input_image_path, output_image_path)
                    return {
                        "success": True,
                        "fallback_used": True,
                        "message": f"{msg} Generated passport photo using built-in high-quality studio engine.",
                        "output_path": output_image_path
                    }
                return {"success": False, "error": msg, "plugin_missing": False}

            # 2. Check SkinFiner
            skinfiner_ok, _ = self.check_skinfiner_installed()
            if not skinfiner_ok:
                if self.settings.auto_fallback_enhancement:
                    logger.info("SkinFiner plugin not installed in Photoshop. Instantly using built-in studio passport enhancement fallback...")
                    self.native_studio_enhancement(input_image_path, output_image_path)
                    return {
                        "success": True,
                        "fallback_used": True,
                        "plugin_missing": True,
                        "message": "SkinFiner plugin is not installed in Photoshop. Processed using built-in Studio Passport Engine.",
                        "output_path": output_image_path
                    }
                else:
                    return {
                        "success": False,
                        "error": "SkinFiner plugin is missing in Photoshop. Please install SkinFiner or enable Auto Fallback in Settings.",
                        "plugin_missing": True
                    }

            # 3. Check action file
            act_ok, act_path = self.check_action_file()
            if not act_ok and not self.settings.auto_fallback_enhancement:
                return {"success": False, "error": act_path, "plugin_missing": False}

            # 4. Prepare normalized input in temp
            temp_dir = Path(self.settings.temp_folder)
            temp_dir.mkdir(parents=True, exist_ok=True)
            run_id = f"{int(time.time() * 1000)}"
            norm_input = temp_dir / f"ps_norm_{run_id}.jpg"
            args_file = temp_dir / f"ps_args_{run_id}.json"
            result_file = temp_dir / f"ps_result_{run_id}.json"

            try:
                self.normalize_image_for_photoshop(input_image_path, str(norm_input))

                # Write args file
                args_data = {
                    "input_path": str(norm_input).replace("\\", "/"),
                    "output_path": str(Path(output_image_path).resolve()).replace("\\", "/"),
                    "action_file": str(Path(act_path).resolve()).replace("\\", "/"),
                    "action_set": action_set,
                    "action_name": action_name,
                    "result_file": str(result_file).replace("\\", "/"),
                    "jpeg_quality": 12
                }
                with open(args_file, "w", encoding="utf-8") as f:
                    json.dump(args_data, f)

                # Set global args pointer for JSX
                global_args = temp_dir / "ps_args.json"
                with open(global_args, "w", encoding="utf-8") as f:
                    json.dump(args_data, f)

                jsx_path = Path(__file__).resolve().parent.parent.parent.parent / "photoshop" / "jsx" / "run_action.jsx"
                if not jsx_path.exists():
                    raise FileNotFoundError(f"JSX script not found at {jsx_path}")

                # Launch Photoshop with the JSX script
                cmd = [
                    str(ps_exe),
                    str(jsx_path)
                ]
                logger.info(f"Launching Photoshop action runner: {' '.join(cmd)}")
                proc = subprocess.Popen(
                    cmd,
                    cwd=str(ps_exe.parent),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )

                # Wait for result file
                start_time = time.time()
                while time.time() - start_time < timeout_seconds:
                    if result_file.exists() and result_file.stat().st_size > 0:
                        break
                    await asyncio.sleep(0.5)

                if result_file.exists() and result_file.stat().st_size > 0:
                    try:
                        with open(result_file, "r", encoding="utf-8") as rf:
                            res_data = json.load(rf)
                    except Exception:
                        with open(result_file, "r", encoding="latin1") as rf:
                            res_data = json.loads(rf.read().strip())

                    if res_data.get("success"):
                        return {
                            "success": True,
                            "fallback_used": False,
                            "message": res_data.get("details", "Photoshop action executed successfully."),
                            "output_path": output_image_path
                        }
                    else:
                        err = res_data.get("error", "Unknown Photoshop error")
                        plugin_missing = res_data.get("plugin_missing", False)
                        logger.warning(f"Photoshop action execution reported error: {err}")

                        # If SkinFiner missing or action failed and fallback enabled
                        if self.settings.auto_fallback_enhancement:
                            logger.info("Executing built-in studio enhancement fallback due to Photoshop error...")
                            self.native_studio_enhancement(input_image_path, output_image_path)
                            return {
                                "success": True,
                                "fallback_used": True,
                                "plugin_missing": plugin_missing,
                                "message": f"Photoshop Notice: {err}. Output generated via built-in Studio Passport Engine.",
                                "output_path": output_image_path
                            }

                        return {
                            "success": False,
                            "error": err,
                            "plugin_missing": plugin_missing
                        }

                # Timed out
                logger.warning(f"Photoshop action timed out after {timeout_seconds} seconds.")
                if self.settings.auto_fallback_enhancement:
                    logger.info("Falling back to built-in studio passport enhancement...")
                    self.native_studio_enhancement(input_image_path, output_image_path)
                    return {
                        "success": True,
                        "fallback_used": True,
                        "message": f"Photoshop timed out ({timeout_seconds}s). Generated output using built-in studio engine.",
                        "output_path": output_image_path
                    }

                return {
                    "success": False,
                    "error": f"Photoshop processing timed out after {timeout_seconds}s.",
                    "plugin_missing": not skinfiner_ok
                }

            finally:
                # Clean up temp run files safely
                for f in [norm_input, args_file, result_file]:
                    try:
                        if f.exists():
                            f.unlink()
                    except Exception:
                        pass


photoshop_service = PhotoshopService()

