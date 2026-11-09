import os
import uuid
import logging
from pathlib import Path
from typing import Optional, List
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse

from app.config.settings import get_settings
from app.services.job_manager import job_manager
from app.schemas.template_schemas import GenerateTemplateRequest, TemplateDetail
from app.services.template_service import template_service
from app.schemas.schemas import JobResponse

router = APIRouter(prefix="/api/templates", tags=["psd_templates"])
logger = logging.getLogger("templates_api")

def resolve_photo_path(photo_id: str, settings) -> Path:
    up_dir = Path(settings.upload_folder)
    out_dir = Path(settings.output_folder)

    for f in list(up_dir.glob(f"{photo_id}*")) + list(out_dir.glob(f"*{photo_id}*")):
        if f.suffix.lower() in [".jpg", ".jpeg", ".png"]:
            return f

    f_up = up_dir / photo_id
    if f_up.exists():
        return f_up
    f_out = out_dir / photo_id
    if f_out.exists():
        return f_out

    raise FileNotFoundError(f"Photograph with ID '{photo_id}' not found.")

async def process_template_job(
    job_id: str,
    output_id: str,
    req: GenerateTemplateRequest,
    output_path: str
):
    settings = get_settings()
    try:
        job_manager.update_job(
            job_id,
            status="generating_sheet",
            progress=20,
            message="Preparing photos and template layers..."
        )

        # Resolve photo paths
        resolved_photos = []
        for pa in req.photo_assignments:
            try:
                p_path = resolve_photo_path(pa.photo_id, settings)
                resolved_photos.append({
                    "slot_name": pa.slot_name,
                    "photo_path": str(p_path)
                })
            except Exception as e:
                logger.warning(f"Could not resolve photo {pa.photo_id}: {e}")

        text_reps = [{"layer_name": ta.layer_name, "text": ta.text} for ta in req.text_assignments]

        job_manager.update_job(
            job_id,
            progress=50,
            message="Compositing photos into PSD slots and rendering typography..."
        )

        template_service.generate_template_output(
            template_id=req.template_id,
            output_path=output_path,
            photo_replacements=resolved_photos,
            text_replacements=text_reps,
            jpeg_quality=req.jpeg_quality or 95
        )

        job_manager.update_job(
            job_id,
            status="completed",
            progress=100,
            message="Print-ready PSD poster generated successfully at 300 DPI.",
            result_url=f"/api/templates/output/{output_id}/download",
            preview_url=f"/api/templates/output/{output_id}/view",
            meta_updates={
                "output_id": output_id,
                "template_id": req.template_id,
                "photos_placed": len(resolved_photos),
                "texts_updated": len(text_reps)
            }
        )
    except Exception as e:
        logger.error(f"Error generating template output: {e}", exc_info=True)
        job_manager.update_job(
            job_id,
            status="failed",
            progress=100,
            message=f"Template generation failed: {str(e)}",
            error=str(e)
        )

@router.get("/categories")
async def get_categories():
    """Returns list of all template categories with counts."""
    return {"categories": template_service.get_categories()}

@router.get("")
async def list_templates(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0)
):
    """Returns paginated templates filtered by category or search term."""
    return template_service.list_templates(category=category, search=search, limit=limit, offset=offset)

@router.get("/{template_id}/preview")
async def get_template_preview(template_id: str):
    """Serves fast web thumbnail of the template."""
    try:
        prev_file = template_service.get_template_preview_file(template_id)
        return FileResponse(str(prev_file), media_type="image/jpeg")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template preview not found.")

@router.get("/{template_id}/details", response_model=TemplateDetail)
async def get_template_details(template_id: str):
    """Deeply inspects photo slots and text fields of the template."""
    try:
        return template_service.inspect_template_details(template_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found.")

@router.post("/generate", response_model=JobResponse)
async def generate_template(req: GenerateTemplateRequest, background_tasks: BackgroundTasks):
    """Generates print-ready output from the PSD template."""
    settings = get_settings()
    output_id = str(uuid.uuid4())
    output_filename = f"psd_poster_{output_id}.jpg"
    output_path = Path(settings.output_folder) / output_filename

    job = job_manager.create_job(
        mode="template",
        message="Initializing PSD template generator...",
        meta={
            "output_id": output_id,
            "template_id": req.template_id,
            "photos_count": len(req.photo_assignments),
            "engine": req.engine
        }
    )

    background_tasks.add_task(
        process_template_job,
        job.id,
        output_id,
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
        result_url="",
        preview_url="",
        meta=job.meta
    )

@router.get("/output/{output_id}/view")
async def view_template_output(output_id: str):
    settings = get_settings()
    out_dir = Path(settings.output_folder)
    matched = list(out_dir.glob(f"psd_poster_{output_id}.jpg"))
    if not matched:
        raise HTTPException(status_code=404, detail="Generated output not found.")
    return FileResponse(str(matched[0]), media_type="image/jpeg")

@router.get("/output/{output_id}/download")
async def download_template_output(output_id: str):
    settings = get_settings()
    out_dir = Path(settings.output_folder)
    matched = list(out_dir.glob(f"psd_poster_{output_id}.jpg"))
    if not matched:
        raise HTTPException(status_code=404, detail="Generated output not found.")
    return FileResponse(
        str(matched[0]),
        media_type="image/jpeg",
        filename=f"pjk_psd_poster_{output_id[:8]}.jpg",
        headers={"Content-Disposition": f"attachment; filename=pjk_psd_poster_{output_id[:8]}.jpg"}
    )
