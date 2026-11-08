import logging
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config.settings import get_settings
from app.photoshop.photoshop_service import photoshop_service
from app.services.job_manager import job_manager
from app.schemas.schemas import HealthResponse
from app.api.photos import router as photos_router
from app.api.sheets import router as sheets_router
from app.api.jobs import router as jobs_router
from app.api.settings_api import router as settings_router
from app.api.history import router as history_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("pjk_studio")

app = FastAPI(
    title="PJK Passport Photo Automation Studio API",
    description="Backend API for PJK Xerox Passport Photo Automation Studio with Photoshop CS6 Integration and Local AI Background Removal.",
    version="1.0.0"
)

# CORS configuration for local React Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static folders for images
settings = get_settings()
uploads_dir = Path(settings.upload_folder)
outputs_dir = Path(settings.output_folder)
uploads_dir.mkdir(parents=True, exist_ok=True)
outputs_dir.mkdir(parents=True, exist_ok=True)

app.mount("/static/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
app.mount("/static/outputs", StaticFiles(directory=str(outputs_dir)), name="outputs")

# Include API routers
app.include_router(photos_router)
app.include_router(sheets_router)
app.include_router(jobs_router)
app.include_router(settings_router)
app.include_router(history_router)

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """System health check and diagnostic inspection."""
    ps_status = photoshop_service.get_status()
    stats = job_manager.get_stats()

    return HealthResponse(
        status="ok",
        version="1.0.0",
        photoshop_installed=ps_status["photoshop_installed"],
        photoshop_path=ps_status["photoshop_path"],
        photoshop_running=ps_status["photoshop_running"],
        skinfiner_installed=ps_status["skinfiner_installed"],
        skinfiner_info=ps_status["skinfiner_info"],
        native_cs6_supported=ps_status.get("native_cs6_supported", True),
        active_engine_mode=ps_status.get("active_engine_mode", "photoshop_cs6_native"),
        action_file_exists=ps_status["action_file_exists"],
        action_file_path=ps_status["action_file_path"],
        action_set_name=ps_status["action_set_name"],
        action_name=ps_status["action_name"],
        stats=stats
    )

# Mount frontend production build if available (must be mounted after all API routes)
dist_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="frontend")

@app.on_event("startup")
async def on_startup():
    logger.info("Starting PJK Passport Photo Automation Studio Backend...")
    ps_status = photoshop_service.get_status()
    logger.info(f"Photoshop Installed: {ps_status['photoshop_installed']} (Path: {ps_status['photoshop_path']})")
    logger.info(f"Action File Exists: {ps_status['action_file_exists']} (Path: {ps_status['action_file_path']})")
    logger.info(f"SkinFiner Installed: {ps_status['skinfiner_installed']} ({ps_status['skinfiner_info']})")
    if not ps_status["skinfiner_installed"]:
        logger.warning("SkinFiner plugin is missing in Photoshop. Built-in Studio Passport Enhancement is active as fallback.")
