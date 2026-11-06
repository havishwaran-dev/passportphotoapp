import asyncio
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

from app.config.settings import get_settings
from app.schemas.schemas import GenerateSheetRequest, JobResponse
from app.services.job_manager import job_manager
from app.photo_layout.sheet_generator import sheet_generator
from app.api.photos import get_photo_path

router = APIRouter(prefix="/api/sheets", tags=["sheets"])

_sheet_registry: dict = {}

def get_sheet_path(sheet_id: str) -> Optional[Path]:
    settings = get_settings()
    if sheet_id in _sheet_registry:
        p = Path(_sheet_registry[sheet_id]["path"])
        if p.exists():
            return p

    out_dir = Path(settings.output_folder)
    candidate = out_dir / f"sheet_{sheet_id}.jpg"
    if candidate.exists():
        return candidate

    return None

async def run_sheet_job(job_id: str, req: GenerateSheetRequest):
    try:
        settings = get_settings()
        out_dir = Path(settings.output_folder)
        out_dir.mkdir(parents=True, exist_ok=True)
        sheet_id = str(uuid.uuid4())
        output_path = out_dir / f"sheet_{sheet_id}.jpg"

        job_manager.update_job(job_id, status="generating_sheet", progress=30, message="Calculating 4x6 layout & scaling photos...")
        await asyncio.sleep(0.2)

        # Resolve photo items to file paths
        resolved_items = []
        for p_item in req.photos:
            p_path = get_photo_path(p_item.photo_id)
            if p_path and p_path.exists():
                resolved_items.append({
                    "path": str(p_path),
                    "copies": p_item.copies
                })

        if not resolved_items:
            job_manager.update_job(job_id, status="failed", error="No valid photographs provided for sheet layout.")
            return

        job_manager.update_job(job_id, status="generating_sheet", progress=60, message="Assembling high-resolution 300 DPI 4x6 photo sheet...")

        loop = asyncio.get_event_loop()
        meta = await loop.run_in_executor(
            None,
            sheet_generator.generate_sheet,
            resolved_items,
            str(output_path),
            req.orientation,
            settings.passport_width_mm,
            settings.passport_height_mm,
            req.spacing_mm,
            req.margin_mm,
            settings.dpi,
            req.cutting_guides,
            req.bg_color
        )

        _sheet_registry[sheet_id] = {
            "path": str(output_path),
            "meta": meta
        }

        job_manager.update_job(
            job_id,
            status="completed",
            progress=100,
            message=f"4x6 Photo sheet generated successfully ({meta['photos_placed']} photos placed).",
            sheet_id=sheet_id,
            result_url=f"/api/sheets/{sheet_id}/download",
            preview_url=f"/api/sheets/{sheet_id}/view",
            meta_updates=meta
        )
    except Exception as e:
        job_manager.update_job(job_id, status="failed", progress=100, error=str(e), message="Sheet generation error")

@router.post("/generate", response_model=JobResponse)
async def generate_sheet(req: GenerateSheetRequest, background_tasks: BackgroundTasks):
    """Generates a 4x6 inch high-resolution print sheet with multiple passport photos."""
    if not req.photos:
        raise HTTPException(status_code=400, detail="Please select at least one photo.")

    job = job_manager.create_job(mode="sheet", meta={"orientation": req.orientation, "num_photos": len(req.photos)})
    background_tasks.add_task(run_sheet_job, job.id, req)
    return JobResponse(**job.model_dump(), job_id=job.id)

@router.get("/{sheet_id}/download")
async def download_sheet(sheet_id: str):
    """Downloads the generated 4x6 photo sheet as high-quality JPEG."""
    path = get_sheet_path(sheet_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo sheet not found")

    filename = f"PJK_PhotoSheet_4x6_{sheet_id[:8]}.jpg"
    return FileResponse(
        path=path,
        media_type="image/jpeg",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/{sheet_id}/view")
async def view_sheet(sheet_id: str):
    """Serves the generated photo sheet for UI preview."""
    path = get_sheet_path(sheet_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Photo sheet not found")

    return FileResponse(path=path, media_type="image/jpeg")
