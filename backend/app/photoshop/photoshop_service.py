import asyncio
import json
import logging
import os
import shutil
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
        """
        Dynamically finds or validates the Photoshop executable path.
        Checks:
        1. Configured path in settings
        2. Windows Registry (HKLM & HKCU, 64-bit & 32-bit Wow6432Node)
        3. Common drive install locations (C:, D:, E:)
        4. System PATH
        """
        # 1. Configured path
        if self.settings.photoshop_exe_path:
            p = Path(self.settings.photoshop_exe_path)
            if p.exists() and p.is_file() and p.name.lower() == "photoshop.exe":
                return p

        # 2. Windows Registry scan (Works on any machine/drive)
        if os.name == "nt":
            try:
                import winreg
                roots = [winreg.HKEY_LOCAL_MACHINE, winreg.HKEY_CURRENT_USER]
                subkeys = [
                    r"SOFTWARE\Adobe\Photoshop",
                    r"SOFTWARE\WOW6432Node\Adobe\Photoshop"
                ]
                for r in roots:
                    for sub in subkeys:
                        try:
                            k = winreg.OpenKey(r, sub)
                            for i in range(winreg.QueryInfoKey(k)[0]):
                                ver = winreg.EnumKey(k, i)
                                try:
                                    vk = winreg.OpenKey(k, ver)
                                    app_path, _ = winreg.QueryValueEx(vk, "ApplicationPath")
                                    exe = Path(app_path) / "Photoshop.exe"
                                    if exe.exists():
                                        return exe
                                except Exception:
                                    pass
                        except Exception:
                            pass
            except Exception as e:
                logger.debug(f"Registry scan error: {e}")

        # 3. Common drive search paths on Windows
        drives = ["C:", "D:", "E:"]
        subfolders = [
            r"Program Files\Adobe\Adobe Photoshop CS6 (x64)\Photoshop.exe",
            r"Program Files\Adobe\Adobe Photoshop CS6\Photoshop.exe",
            r"Program Files (x86)\Adobe\Adobe Photoshop CS6\Photoshop.exe",
            r"Program Files (x86)\Adobe\Adobe Photoshop CS5\Photoshop.exe",
            r"Program Files\Adobe\Adobe Photoshop 2025\Photoshop.exe",
            r"Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe",
            r"Program Files\Adobe\Adobe Photoshop 2023\Photoshop.exe",
            r"Program Files\Adobe\Adobe Photoshop 2022\Photoshop.exe",
            r"Program Files\Adobe\Adobe Photoshop CC\Photoshop.exe",
        ]
        for drive in drives:
            for sub in subfolders:
                p = Path(drive) / sub
                if p.exists():
                    return p

        # 4. Check system PATH
        which_ps = shutil.which("photoshop.exe")
        if which_ps:
            return Path(which_ps)

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

        return False, "SkinFiner plugin (.8bf) not found. Photoshop CS6 will use its native Surface Blur studio engine."

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

        active_mode = "photoshop_cs6_native"
        if skinfiner_ok and self.settings.photoshop_engine_mode == "action":
            active_mode = "photoshop_atn"
        elif not ps_exe:
            active_mode = "builtin_studio"

        return {
            "photoshop_installed": ps_exe is not None,
            "photoshop_path": str(ps_exe) if ps_exe else None,
            "photoshop_running": ps_running,
            "skinfiner_installed": skinfiner_ok,
            "skinfiner_info": skinfiner_info,
            "native_cs6_supported": ps_exe is not None,
            "active_engine_mode": active_mode,
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
        target_w = int(round((target_width_mm / 25.4) * dpi))
        target_h = int(round((target_height_mm / 25.4) * dpi))

        pil_img = Image.open(input_path)
        pil_img = ImageOps.exif_transpose(pil_img)
        pil_img = pil_img.convert("RGB")

        curr_w, curr_h = pil_img.size
        target_ratio = target_w / target_h
        curr_ratio = curr_w / curr_h

        if curr_ratio > target_ratio:
            new_w = int(curr_h * target_ratio)
            left = (curr_w - new_w) // 2
            box = (left, 0, left + new_w, curr_h)
            cropped = pil_img.crop(box)
        else:
            new_h = int(curr_w / target_ratio)
            top = max(0, int((curr_h - new_h) * 0.25))
            box = (0, top, curr_w, top + new_h)
            cropped = pil_img.crop(box)

        resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

        cv_img = cv2.cvtColor(np.array(resized), cv2.COLOR_RGB2BGR)
        smoothed = cv2.bilateralFilter(cv_img, d=7, sigmaColor=35, sigmaSpace=35)
        blended = cv2.addWeighted(cv_img, 0.35, smoothed, 0.65, 0)
        result_rgb = cv2.cvtColor(blended, cv2.COLOR_BGR2RGB)
        result_pil = Image.fromarray(result_rgb)

        contrast_enhancer = ImageEnhance.Contrast(result_pil)
        result_pil = contrast_enhancer.enhance(1.05)
        color_enhancer = ImageEnhance.Color(result_pil)
        result_pil = color_enhancer.enhance(1.04)

        if add_stroke and self.settings.border_stroke_width_px > 0:
            draw = ImageDraw.Draw(result_pil)
            border_w = self.settings.border_stroke_width_px
            border_col = self.settings.border_stroke_color
            for i in range(border_w):
                draw.rectangle([i, i, target_w - 1 - i, target_h - 1 - i], outline=border_col)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        result_pil.save(output_path, format="JPEG", quality=self.settings.output_jpeg_quality, dpi=(dpi, dpi))
        return output_path

    async def execute_passport_action(
        self,
        input_image_path: str,
        output_image_path: str,
        action_name: Optional[str] = None,
        action_set: Optional[str] = None,
        timeout_seconds: int = 40
    ) -> Dict[str, Any]:
        """
        Executes the passport action.
        - If Photoshop CS6 is installed:
          Runs Photoshop CS6 via ExtendScript. If SkinFiner is not installed,
          Photoshop CS6 automatically runs the native Surface Blur studio pipeline (zero errors!).
        - If Photoshop is not installed or times out:
          Uses the built-in Studio Passport Engine.
        """
        action_name = action_name or self.settings.action_name
        action_set = action_set or self.settings.action_set_name
        ps_exe = self.get_photoshop_exe()

        async with _ps_lock:
            # 1. Check if Photoshop is available
            if not ps_exe or not ps_exe.exists():
                logger.info("Photoshop executable not detected. Using built-in high-quality studio engine...")
                self.native_studio_enhancement(input_image_path, output_image_path)
                return {
                    "success": True,
                    "fallback_used": True,
                    "engine_used": "builtin_studio",
                    "message": "Processed using built-in high-quality Studio Passport Engine.",
                    "output_path": output_image_path
                }

            # 2. Check SkinFiner state
            skinfiner_ok, _ = self.check_skinfiner_installed()
            act_ok, act_path = self.check_action_file()

            # If configured for native CS6 or SkinFiner is missing, use Native CS6 in Photoshop!
            if self.settings.photoshop_engine_mode == "native_cs6" or not skinfiner_ok:
                jsx_engine_mode = "native_cs6"
            elif self.settings.photoshop_engine_mode == "action" and skinfiner_ok:
                jsx_engine_mode = "action"
            else:
                jsx_engine_mode = "native_cs6" if not skinfiner_ok else "action"

            # 3. Prepare normalized input in temp
            temp_dir = Path(self.settings.temp_folder)
            temp_dir.mkdir(parents=True, exist_ok=True)
            run_id = f"{int(time.time() * 1000)}"
            norm_input = temp_dir / f"ps_norm_{run_id}.jpg"
            args_file = temp_dir / f"ps_args_{run_id}.json"
            result_file = temp_dir / f"ps_result_{run_id}.json"

            try:
                self.normalize_image_for_photoshop(input_image_path, str(norm_input))

                dpi = self.settings.dpi
                target_w_px = int(round((self.settings.passport_width_mm / 25.4) * dpi))
                target_h_px = int(round((self.settings.passport_height_mm / 25.4) * dpi))

                args_data = {
                    "input_path": str(norm_input).replace("\\", "/"),
                    "output_path": str(Path(output_image_path).resolve()).replace("\\", "/"),
                    "action_file": str(Path(act_path).resolve()).replace("\\", "/") if act_ok else "",
                    "action_set": action_set,
                    "action_name": action_name,
                    "result_file": str(result_file).replace("\\", "/"),
                    "jpeg_quality": 12,
                    "target_w_px": target_w_px,
                    "target_h_px": target_h_px,
                    "dpi": dpi,
                    "engine_mode": jsx_engine_mode,
                    "add_stroke": self.settings.border_stroke_width_px > 0,
                    "stroke_color": self.settings.border_stroke_color
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

                cmd = [str(ps_exe), str(jsx_path)]
                logger.info(f"Launching Photoshop CS6 (Engine: {jsx_engine_mode}): {' '.join(cmd)}")

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
                    await asyncio.sleep(0.4)

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
                            "engine_used": res_data.get("engine_used", "photoshop_cs6_native"),
                            "plugin_missing": res_data.get("plugin_missing", False),
                            "message": res_data.get("details", "Processed in Adobe Photoshop CS6 successfully."),
                            "output_path": output_image_path
                        }
                    else:
                        err = res_data.get("error", "Unknown Photoshop error")
                        logger.warning(f"Photoshop action execution error: {err}")
                        if self.settings.auto_fallback_enhancement:
                            logger.info("Executing built-in studio fallback due to Photoshop error...")
                            self.native_studio_enhancement(input_image_path, output_image_path)
                            return {
                                "success": True,
                                "fallback_used": True,
                                "engine_used": "builtin_studio",
                                "message": f"Photoshop Notice: {err}. Output completed via built-in Studio Passport Engine.",
                                "output_path": output_image_path
                            }

                # Timed out
                logger.warning(f"Photoshop action timed out after {timeout_seconds} seconds.")
                if self.settings.auto_fallback_enhancement:
                    logger.info("Falling back to built-in studio passport enhancement...")
                    self.native_studio_enhancement(input_image_path, output_image_path)
                    return {
                        "success": True,
                        "fallback_used": True,
                        "engine_used": "builtin_studio",
                        "message": f"Generated output using built-in high-quality studio engine.",
                        "output_path": output_image_path
                    }

                return {
                    "success": False,
                    "error": f"Photoshop processing timed out after {timeout_seconds}s.",
                    "plugin_missing": not skinfiner_ok
                }

            finally:
                for f in [norm_input, args_file, result_file]:
                    try:
                        if f.exists():
                            f.unlink()
                    except Exception:
                        pass


photoshop_service = PhotoshopService()
