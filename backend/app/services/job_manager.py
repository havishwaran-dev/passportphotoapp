import datetime
import json
import logging
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

logger = logging.getLogger("job_manager")

HISTORY_FILE = Path(__file__).resolve().parent.parent / "config" / "history.json"

class Job(BaseModel):
    id: str
    mode: str
    status: str  # waiting, uploading, preparing, background_replacement, opening_photoshop, running_action, generating_sheet, completed, failed
    progress: int = 0
    message: str = "Job created"
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None
    input_photo_id: Optional[str] = None
    output_photo_id: Optional[str] = None
    sheet_id: Optional[str] = None
    result_url: Optional[str] = None
    preview_url: Optional[str] = None
    error: Optional[str] = None
    meta: Dict[str, Any] = {}

class JobManager:
    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._load_history()

    def _load_history(self):
        if HISTORY_FILE.exists():
            try:
                with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data:
                        job = Job(**item)
                        self._jobs[job.id] = job
            except Exception as e:
                logger.warning(f"Failed to load job history: {e}")

    def _save_history(self):
        try:
            HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
            # Persist last 100 jobs
            all_jobs = list(self._jobs.values())
            all_jobs.sort(key=lambda j: j.created_at, reverse=True)
            to_save = [j.model_dump() for j in all_jobs[:100]]
            with open(HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(to_save, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to save job history: {e}")

    def create_job(self, mode: str, input_photo_id: Optional[str] = None, meta: Optional[Dict[str, Any]] = None) -> Job:
        job_id = str(uuid.uuid4())
        now = datetime.datetime.now().isoformat()
        job = Job(
            id=job_id,
            mode=mode,
            status="waiting",
            progress=0,
            message="Queued for processing",
            created_at=now,
            updated_at=now,
            input_photo_id=input_photo_id,
            meta=meta or {}
        )
        self._jobs[job_id] = job
        self._save_history()
        return job

    def update_job(
        self,
        job_id: str,
        status: Optional[str] = None,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        error: Optional[str] = None,
        output_photo_id: Optional[str] = None,
        sheet_id: Optional[str] = None,
        result_url: Optional[str] = None,
        preview_url: Optional[str] = None,
        meta_updates: Optional[Dict[str, Any]] = None
    ) -> Optional[Job]:
        job = self._jobs.get(job_id)
        if not job:
            return None

        now = datetime.datetime.now().isoformat()
        job.updated_at = now

        if status is not None:
            job.status = status
            if status in ("completed", "failed"):
                job.completed_at = now
        if progress is not None:
            job.progress = progress
        if message is not None:
            job.message = message
        if error is not None:
            job.error = error
        if output_photo_id is not None:
            job.output_photo_id = output_photo_id
        if sheet_id is not None:
            job.sheet_id = sheet_id
        if result_url is not None:
            job.result_url = result_url
        if preview_url is not None:
            job.preview_url = preview_url
        if meta_updates:
            job.meta.update(meta_updates)

        self._save_history()
        return job

    def get_job(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def get_recent_jobs(self, limit: int = 50) -> List[Job]:
        jobs = list(self._jobs.values())
        jobs.sort(key=lambda j: j.created_at, reverse=True)
        return jobs[:limit]

    def get_stats(self) -> Dict[str, Any]:
        jobs = list(self._jobs.values())
        total_photos = sum(1 for j in jobs if j.status == "completed" and j.mode in ("passport", "background", "complete"))
        total_sheets = sum(1 for j in jobs if j.status == "completed" and j.mode == "sheet")

        # Today's jobs
        today_str = datetime.date.today().isoformat()
        today_photos = sum(
            1 for j in jobs
            if j.status == "completed"
            and j.mode in ("passport", "background", "complete")
            and j.created_at.startswith(today_str)
        )
        today_sheets = sum(
            1 for j in jobs
            if j.status == "completed"
            and j.mode == "sheet"
            and j.created_at.startswith(today_str)
        )

        return {
            "total_photos_processed": total_photos,
            "photos_processed_today": today_photos,
            "total_sheets_generated": total_sheets,
            "sheets_generated_today": today_sheets,
            "total_jobs": len(jobs)
        }


job_manager = JobManager()

