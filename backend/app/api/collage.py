import os
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

from app.config.settings import get_settings
from app.services.job_manager import job_manager
from app.schemas.schemas import GenerateCollageRequest, JobResponse
from app.photo_layout.collage_engine import birthday_collage_engine, THEME_COLORS, FONT_MAP
from app.api.photos import get_photo_path

router = APIRouter(prefix="/api/collage", tags=["birthday_collage"])
logger = logging.getLogger("collage_api")

def resolve_photo_path(photo_id: str, settings) -> Path:
    """Finds photo file path by photo_id in uploads or outputs."""
    # First try photo registry
    reg_p = get_photo_path(photo_id)
    if reg_p and reg_p.exists():
        return reg_p

    up_dir = Path(settings.upload_folder)
    out_dir = Path(settings.output_folder)

    for f in list(up_dir.glob(f"{photo_id}*")) + list(out_dir.glob(f"*{photo_id}*")):
        if f.suffix.lower() in [".jpg", ".jpeg", ".png"]:
            return f

    # Check by filename directly
    f_up = up_dir / photo_id
    if f_up.exists():
        return f_up
    f_out = out_dir / photo_id
    if f_out.exists():
        return f_out

    raise FileNotFoundError(f"Photograph with ID '{photo_id}' was not found in studio storage.")


async def process_collage_job(
    job_id: str,
    collage_id: str,
    req: GenerateCollageRequest,
    output_path: str
):
    settings = get_settings()
    try:
        job_manager.update_job(
            job_id,
            status="generating_sheet",
            progress=20,
            message=f"Preparing {len(req.photos)} photographs for A4 Birthday Collage..."
        )

        resolved_paths: List[str] = []
        for pid in req.photos:
            p_path = resolve_photo_path(pid, settings)
            resolved_paths.append(str(p_path))

        job_manager.update_job(
            job_id,
            progress=50,
            message="Arranging layout slots and rendering TrueType typography..."
        )

        # Run collage generator
        birthday_collage_engine.generate_birthday_collage(
            photo_paths=resolved_paths,
            output_path=output_path,
            orientation=req.orientation or "portrait",
            template_id=req.template_id or "hero_celebration",
            theme_id=req.theme_id or "gold_luxury",
            custom_bg_color=req.custom_bg_color,
            title=req.title or "HAPPY BIRTHDAY",
            name=req.name or "CELEBRANT",
            subtitle=req.subtitle or "Wishing you joy, love & happiness on your special day!",
            font_family=req.font_family or "georgia",
            font_size_scale=req.font_size_scale or 1.0,
            show_decorations=req.show_decorations if req.show_decorations is not None else True,
            rounded_corners=req.rounded_corners if req.rounded_corners is not None else True,
            border_width=req.border_width if req.border_width is not None else 8
        )

        job_manager.update_job(
            job_id,
            status="completed",
            progress=100,
            message="A4 Birthday Photo Collage created successfully at 300 DPI.",
            collage_id=collage_id,
            result_url=f"/api/collage/{collage_id}/download",
            preview_url=f"/api/collage/{collage_id}/view",
            meta_updates={
                "collage_id": collage_id,
                "photos_count": len(resolved_paths),
                "orientation": req.orientation,
                "template": req.template_id,
                "theme": req.theme_id,
                "title": req.title,
                "name": req.name
            }
        )
    except Exception as e:
        logger.error(f"Error generating collage: {e}", exc_info=True)
        job_manager.update_job(
            job_id,
            status="failed",
            progress=100,
            message=f"Failed to generate collage: {str(e)}",
            error=str(e)
        )


@router.post("/generate", response_model=JobResponse)
@router.post("/generate/", response_model=JobResponse)
async def generate_collage(req: GenerateCollageRequest, background_tasks: BackgroundTasks):
    """
    Arranges 2 to 20 photographs into a print-ready A4 Birthday Collage poster at 300 DPI.
    """
    if len(req.photos) < 2:
        raise HTTPException(status_code=400, detail="Collage requires at least 2 photographs.")
    if len(req.photos) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 photographs allowed per collage.")

    settings = get_settings()
    collage_id = str(uuid.uuid4())
    output_filename = f"collage_{collage_id}.jpg"
    output_path = Path(settings.output_folder) / output_filename

    job = job_manager.create_job(
        mode="collage",
        message="Initializing A4 Birthday Photo Collage...",
        meta={
            "collage_id": collage_id,
            "photos_count": len(req.photos),
            "template": req.template_id,
            "theme": req.theme_id
        }
    )

    background_tasks.add_task(
        process_collage_job,
        job.id,
        collage_id,
        req,
        str(output_path)
    )

    return JobResponse(
        job_id=job.id,
        mode=job.mode,
        status=job.status,
        progress=job.progress,
        message=job.message,
        created_at=job.created_at,
        updated_at=job.updated_at,
        collage_id=collage_id,
        meta=job.meta
    )


@router.get("/{collage_id}/view")
async def view_collage(collage_id: str):
    """Returns the collage image for web canvas preview."""
    settings = get_settings()
    out_dir = Path(settings.output_folder)
    matched = list(out_dir.glob(f"collage_{collage_id}.jpg"))
    if not matched:
        raise HTTPException(status_code=404, detail="Collage image not found.")
    return FileResponse(str(matched[0]), media_type="image/jpeg")


@router.get("/{collage_id}/download")
async def download_collage(collage_id: str):
    """Downloads the full-resolution 300 DPI A4 JPEG for printing."""
    settings = get_settings()
    out_dir = Path(settings.output_folder)
    matched = list(out_dir.glob(f"collage_{collage_id}.jpg"))
    if not matched:
        raise HTTPException(status_code=404, detail="Collage image not found.")
    return FileResponse(
        str(matched[0]),
        media_type="image/jpeg",
        filename=f"pjk_birthday_poster_{collage_id[:8]}.jpg",
        headers={"Content-Disposition": f"attachment; filename=pjk_birthday_poster_{collage_id[:8]}.jpg"}
    )


@router.get("/presets")
@router.get("/presets/")
async def get_presets():
    """Returns available templates, themes, and typography options."""
    templates = [
        {
            "id": "hero_celebration",
            "name": "Hero Celebration",
            "description": "1 prominent large spotlight photo of the birthday person + balanced surrounding photos.",
            "badge": "Recommended"
        },
        {
            "id": "balanced_mosaic",
            "name": "Balanced Mosaic",
            "description": "Clean, symmetric multi-photo grid with elegant borders and even spacing.",
            "badge": "Popular"
        },
        {
            "id": "polaroid",
            "name": "Festive Polaroid Cards",
            "description": "Retro white framed cards with soft drop shadows on a festive background.",
            "badge": "Fun & Retro"
        }
    ]

    themes = [
        {"id": "gold_luxury", "name": "Royal Gold & Slate", "preview_bg": "#0F172A", "preview_accent": "#F59E0B"},
        {"id": "midnight_blue", "name": "Midnight Electric", "preview_bg": "#0A192F", "preview_accent": "#38BDF8"},
        {"id": "white", "name": "Minimalist Studio White", "preview_bg": "#FFFFFF", "preview_accent": "#2563EB"},
        {"id": "pastel_pink", "name": "Sweet Rose & Pink", "preview_bg": "#FFF1F2", "preview_accent": "#E11D48"},
        {"id": "sky_celebration", "name": "Sky Blue Party", "preview_bg": "#F0F9FF", "preview_accent": "#0284C7"},
        {"id": "festive_party", "name": "Festive Carnival", "preview_bg": "#FEF2F2", "preview_accent": "#DC2626"},
    ]

    fonts = [
        {"id": "georgia", "name": "Georgia (Elegant Serif)", "preview": "Happy Birthday"},
        {"id": "arial", "name": "Arial (Modern Bold)", "preview": "Happy Birthday"},
        {"id": "times", "name": "Times New Roman (Classic Royal)", "preview": "Happy Birthday"},
        {"id": "segoeui", "name": "Segoe UI (Clean Fluent)", "preview": "Happy Birthday"},
        {"id": "comic", "name": "Comic Sans (Playful Kids Party)", "preview": "Happy Birthday"},
        {"id": "impact", "name": "Impact (Punchy Headline)", "preview": "HAPPY BIRTHDAY"},
    ]

    return {
        "templates": templates,
        "themes": themes,
        "fonts": fonts
    }

