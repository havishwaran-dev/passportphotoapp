from fastapi import APIRouter
from app.config.settings import get_settings, save_settings, AppSettings

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("", response_model=AppSettings)
async def fetch_settings():
    """Returns the persistent application settings."""
    return get_settings()

@router.post("", response_model=AppSettings)
async def update_settings(new_settings: AppSettings):
    """Updates and saves persistent application settings."""
    return save_settings(new_settings)

