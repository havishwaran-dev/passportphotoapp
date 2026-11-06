from typing import List, Dict, Any
from fastapi import APIRouter
from app.schemas.schemas import JobResponse
from app.services.job_manager import job_manager

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("", response_model=List[JobResponse])
async def get_history(limit: int = 50):
    """Retrieves recently processed jobs for history and gallery."""
    jobs = job_manager.get_recent_jobs(limit=limit)
    return [JobResponse(**j.model_dump(), job_id=j.id) for j in jobs]

@router.get("/stats", response_model=Dict[str, Any])
async def get_statistics():
    """Returns dashboard statistics (photos today, total photos, etc.)."""
    return job_manager.get_stats()

