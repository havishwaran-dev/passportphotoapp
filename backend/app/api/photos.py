import asyncio
import os
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from PIL import Image, ImageOps

from app.config.settings import get_settings
from app.schemas.schemas import (
    PhotoInfo, PhotoUploadResponse, ProcessPassportRequest,
    ReplaceBackgroundRequest, ProcessCompleteRequest, RotatePhotoRequest, JobResponse
)
from app.services.job_manager import job_manager
from app.photoshop.photoshop_service import photoshop_service
from app.image_processing.background_remover import background_remover

router = APIRouter(prefix="/api/photos", tags=["photos"])

# Store metadata of uploaded & processed photos in memory for fast retrieval
_photo_registry: dict = {}

def get_photo_path(photo_id: str) -> Optional[Path]:
    """Resolves photo_id to an existing file in uploads or outputs."""
    settings = get_settings()
    # Check registry
    if photo_id in _photo_registry:
        p = Path(_photo_registry[photo_id]["path"])
        if p.exists():
            return p

    # Check uploads
    up_dir = Path(settings.upload_folder)
    for ext in (".jpg", ".jpeg", ".png"):
        p = up_dir / f"{photo_id}{ext}"
        if p.exists():
            return p

    # Check outputs
    out_dir = Path(settings.output_folder)
    for ext in (".jpg", ".jpeg", ".png"):
        p = out_dir / f"{photo_id}{ext}"
        if p.exists():
            return p

    return None

def register_photo(photo_id: str, path: str, original_name: str) -> PhotoInfo:
    p = Path(path)
    img = Image.open(p)
    w, h = img.size
    size = p.stat().st_size

    info = PhotoInfo(
        photo_id=photo_id,
        filename=p.name,
        original_name=original_name,
        width=w,
        height=h,
        url=f"/api/photos/{photo_id}/view",
        thumbnail_url=f"/api/photos/{photo_id}/view",
        size_bytes=size
    )
    _photo_registry[photo_id] = {
        "path": str(p),
        "info": info
    }
    return info

@router.post("/upload", response_model=PhotoUploadResponse)
async def upload_photos(files: List[UploadFile] = File(...)):
    """Uploads one or multiple photographs (JPG, JPEG, PNG)."""
    settings = get_settings()
    upload_dir = Path(settings.upload_folder)
    upload_dir.mkdir(parents=True, exist_ok=True)

    allowed_exts = {".jpg", ".jpeg", ".png"}
    saved_photos: List[PhotoInfo] = []

    for file in files:
        ext = Path(file.filename or "photo.jpg").suffix.lower()
        if ext not in allowed_exts:
            ext = ".jpg"

        photo_id = str(uuid.uuid4())
        dest_filename = f"{photo_id}{ext}"
        dest_path = upload_dir / dest_filename

        # Write uploaded contents
        contents = await file.read()
        if len(contents) == 0:
            continue

        with open(dest_path, "wb") as f:
            f.write(contents)

        # Normalize orientation using Pillow without modifying identity
        try:
            with Image.open(dest_path) as im:
                oriented = ImageOps.exif_transpose(im)
                oriented.save(dest_path)
        except Exception:
            pass

        info = register_photo(photo_id, str(dest_path), file.filename or dest_filename)
        saved_photos.append(info)

    if not saved_photos:
        raise HTTPException(status_code=400, detail="No valid image files provided.")

    return PhotoUploadResponse(
        success=True,
        photos=saved_photos,
        message=f"Successfully uploaded {len(saved_photos)} photo(s)."
    )

@router.post("/rotate", response_model=PhotoInfo)
async def rotate_photo(req: RotatePhotoRequest):
    """Rotates an uploaded photo by 90, 180, or 270 degrees."""
    path = get_photo_path(req.photo_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    img = Image.open(path)
    # PIL rotate rotates counter-clockwise for positive degrees
    # Negative angle for clockwise
    rotated = img.rotate(-req.angle, expand=True)
    rotated.save(path, quality=95)

    return register_photo(req.photo_id, str(path), path.name)

# --- Background Task Workers ---

async def run_passport_job(job_id: str, photo_id: str, action_name: Optional[str], action_set: Optional[str], auto_fallback: bool):
    try:
        input_path = get_photo_path(photo_id)
        if not input_path:
            job_manager.update_job(job_id, status="failed", error="Input photo not found")
            return

        settings = get_settings()
        out_dir = Path(settings.output_folder)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_photo_id = str(uuid.uuid4())
        output_path = out_dir / f"{out_photo_id}.jpg"

        job_manager.update_job(job_id, status="preparing", progress=20, message="Preparing photograph for Photoshop...")
        await asyncio.sleep(0.3)

        job_manager.update_job(job_id, status="opening_photoshop", progress=40, message="Opening Adobe Photoshop CS6...")
        await asyncio.sleep(0.3)

        job_manager.update_job(job_id, status="running_action", progress=60, message=f"Running action '{action_name or settings.action_name}' from set '{action_set or settings.action_set_name}'...")

        res = await photoshop_service.execute_passport_action(
            input_image_path=str(input_path),
            output_image_path=str(output_path),
            action_name=action_name,
            action_set=action_set
        )

        if res.get("success"):
            register_photo(out_photo_id, str(output_path), f"passport_{photo_id}.jpg")
            job_manager.update_job(
                job_id,
                status="completed",
                progress=100,
                message=res.get("message", "Passport photo processed successfully."),
                output_photo_id=out_photo_id,
                result_url=f"/api/photos/{out_photo_id}/download",
                preview_url=f"/api/photos/{out_photo_id}/view",
                meta_updates={
                    "fallback_used": res.get("fallback_used", False),
                    "plugin_missing": res.get("plugin_missing", False)
                }
            )
        else:
            job_manager.update_job(
                job_id,
                status="failed",
                progress=100,
                message="Processing failed",
                error=res.get("error", "Photoshop processing error"),
                meta_updates={"plugin_missing": res.get("plugin_missing", False)}
            )
    except Exception as e:
        job_manager.update_job(job_id, status="failed", progress=100, error=str(e), message="Internal processing error")

async def run_background_job(job_id: str, photo_id: str, bg_color: str):
    try:
        input_path = get_photo_path(photo_id)
        if not input_path:
            job_manager.update_job(job_id, status="failed", error="Input photo not found")
            return

        settings = get_settings()
        out_dir = Path(settings.output_folder)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_photo_id = str(uuid.uuid4())
        output_path = out_dir / f"{out_photo_id}.jpg"

        job_manager.update_job(job_id, status="preparing", progress=25, message="Preparing image for AI background segmentation...")
        await asyncio.sleep(0.2)

        job_manager.update_job(job_id, status="background_replacement", progress=60, message=f"Separating subject & applying background ({bg_color})...")

        # Run segmentation in thread pool to not block async loop
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            background_remover.replace_background,
            str(input_path),
            str(output_path),
            bg_color,
            settings.output_jpeg_quality,
            settings.dpi
        )

        register_photo(out_photo_id, str(output_path), f"bg_{photo_id}.jpg")
        job_manager.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Background replaced successfully.",
            output_photo_id=out_photo_id,
            result_url=f"/api/photos/{out_photo_id}/download",
            preview_url=f"/api/photos/{out_photo_id}/view",
            meta_updates={"bg_color": bg_color}
        )
    except Exception as e:
        job_manager.update_job(job_id, status="failed", progress=100, error=str(e), message="Background replacement error")

async def run_complete_job(job_id: str, photo_id: str, bg_color: Optional[str], auto_fallback: bool):
    try:
        input_path = get_photo_path(photo_id)
        if not input_path:
            job_manager.update_job(job_id, status="failed", error="Input photo not found")
            return

        settings = get_settings()
        temp_dir = Path(settings.temp_folder)
        temp_dir.mkdir(parents=True, exist_ok=True)
        out_dir = Path(settings.output_folder)
        out_dir.mkdir(parents=True, exist_ok=True)

        current_img_path = str(input_path)

        # Step 1: Replace background if specified
        if bg_color and bg_color.lower() not in ("original", "keep", "none"):
            job_manager.update_job(job_id, status="background_replacement", progress=30, message=f"Step 1/2: Replacing background with {bg_color}...")
            bg_temp_path = str(temp_dir / f"bg_step_{job_id}.jpg")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                background_remover.replace_background,
                current_img_path,
                bg_temp_path,
                bg_color,
                settings.output_jpeg_quality,
                settings.dpi
            )
            current_img_path = bg_temp_path

        # Step 2: Run Photoshop Passport Action
        job_manager.update_job(job_id, status="opening_photoshop", progress=60, message="Step 2/2: Opening Photoshop & executing passport action...")
        out_photo_id = str(uuid.uuid4())
        output_path = out_dir / f"{out_photo_id}.jpg"

        res = await photoshop_service.execute_passport_action(
            input_image_path=current_img_path,
            output_image_path=str(output_path)
        )

        # Cleanup temp step if created
        if current_img_path != str(input_path) and Path(current_img_path).exists():
            try:
                Path(current_img_path).unlink()
            except Exception:
                pass

        if res.get("success"):
            register_photo(out_photo_id, str(output_path), f"complete_{photo_id}.jpg")
            job_manager.update_job(
                job_id,
                status="completed",
                progress=100,
                message=res.get("message", "Complete passport processing finished successfully."),
                output_photo_id=out_photo_id,
                result_url=f"/api/photos/{out_photo_id}/download",
                preview_url=f"/api/photos/{out_photo_id}/view",
                meta_updates={
                    "fallback_used": res.get("fallback_used", False),
                    "plugin_missing": res.get("plugin_missing", False),
                    "bg_color": bg_color
                }
            )
        else:
            job_manager.update_job(
                job_id,
                status="failed",
                progress=100,
                message="Processing failed",
                error=res.get("error", "Photoshop action error"),
                meta_updates={"plugin_missing": res.get("plugin_missing", False)}
            )
    except Exception as e:
        job_manager.update_job(job_id, status="failed", progress=100, error=str(e), message="Complete processing error")

# --- Endpoints ---

@router.post("/process-passport", response_model=JobResponse)
async def process_passport(req: ProcessPassportRequest, background_tasks: BackgroundTasks):
    """Mode 1: Runs Photoshop action on individual photo."""
    path = get_photo_path(req.photo_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    job = job_manager.create_job(mode="passport", input_photo_id=req.photo_id)
    background_tasks.add_task(
        run_passport_job,
        job.id,
        req.photo_id,
        req.action_name,
        req.action_set,
        req.auto_fallback
    )
    return JobResponse(**job.model_dump(), job_id=job.id)

@router.post("/replace-background", response_model=JobResponse)
async def replace_background(req: ReplaceBackgroundRequest, background_tasks: BackgroundTasks):
    """Mode 2: Local AI human segmentation & background replacement."""
    path = get_photo_path(req.photo_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    job = job_manager.create_job(mode="background", input_photo_id=req.photo_id, meta={"bg_color": req.bg_color})
    background_tasks.add_task(
        run_background_job,
        job.id,
        req.photo_id,
        req.bg_color
    )
    return JobResponse(**job.model_dump(), job_id=job.id)

@router.post("/process-complete", response_model=JobResponse)
async def process_complete(req: ProcessCompleteRequest, background_tasks: BackgroundTasks):
    """Mode 3: Background replacement + Photoshop passport action."""
    path = get_photo_path(req.photo_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    job = job_manager.create_job(mode="complete", input_photo_id=req.photo_id, meta={"bg_color": req.bg_color})
    background_tasks.add_task(
        run_complete_job,
        job.id,
        req.photo_id,
        req.bg_color,
        req.auto_fallback
    )
    return JobResponse(**job.model_dump(), job_id=job.id)

@router.get("/{photo_id}/download")
async def download_photo(photo_id: str):
    """Downloads the processed photograph."""
    path = get_photo_path(photo_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    filename = f"PJK_passport_{photo_id[:8]}.jpg"
    return FileResponse(
        path=path,
        media_type="image/jpeg",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{photo_id}/view")
async def view_photo(photo_id: str):
    """Serves the photograph for UI preview."""
    path = get_photo_path(photo_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    media_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(path=path, media_type=media_type)

