from fastapi import APIRouter, HTTPException
from app.schemas.schemas import JobResponse
from app.services.job_manager import job_manager

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

@router.get("/{job_id}", response_model=JobResponse)
async def get_job_status(job_id: str):
    """Retrieves real-time processing status of a job."""
    job = job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse(**job.model_dump(), job_id=job.id)

