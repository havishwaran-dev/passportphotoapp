import sys
import os
import time
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_api_pipeline():
    print("\n--- Starting Full API Pipeline Integration Test ---")

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health = res.json()
    print(f"[PASS] /api/health: status={health['status']}, PS={health['photoshop_installed']}, SkinFiner={health['skinfiner_installed']}")

    # 2. Settings check
    res = client.get("/api/settings")
    assert res.status_code == 200, f"Settings GET failed: {res.text}"
    settings = res.json()
    assert settings["passport_width_mm"] == 35.0
    print(f"[PASS] /api/settings: default_bg={settings['default_bg_color']}, size={settings['passport_width_mm']}x{settings['passport_height_mm']}mm")

    # 3. Upload photo
    sample_photo = Path("C:/Users/hmath/Downloads/Photo/WhatsApp Image 2026-10-24 at 9.16.01 PM (1).jpeg")
    assert sample_photo.exists(), f"Sample photo not found at {sample_photo}"

    with open(sample_photo, "rb") as f:
        res = client.post("/api/photos/upload", files={"files": ("sample.jpeg", f, "image/jpeg")})
    assert res.status_code == 200, f"Upload failed: {res.text}"
    upload_data = res.json()
    assert upload_data["success"] is True
    assert len(upload_data["photos"]) > 0
    photo = upload_data["photos"][0]
    photo_id = photo["photo_id"]
    print(f"[PASS] /api/photos/upload: photo_id={photo_id}, dimensions={photo['width']}x{photo['height']}")

    # 4. Rotate photo
    res = client.post("/api/photos/rotate", json={"photo_id": photo_id, "angle": 90})
    assert res.status_code == 200, f"Rotate failed: {res.text}"
    rotated = res.json()
    print(f"[PASS] /api/photos/rotate: new dimensions={rotated['width']}x{rotated['height']}")

    # Rotate back
    res = client.post("/api/photos/rotate", json={"photo_id": photo_id, "angle": 270})
    assert res.status_code == 200

    # 5. Background replacement
    res = client.post("/api/photos/replace-background", json={"photo_id": photo_id, "bg_color": "#0080FF"})
    assert res.status_code == 200, f"Replace BG failed: {res.text}"
    bg_job = res.json()
    bg_job_id = bg_job["job_id"]
    print(f"[PASS] /api/photos/replace-background started: job_id={bg_job_id}")

    # Poll BG job
    final_bg_job = None
    for _ in range(30):
        res = client.get(f"/api/jobs/{bg_job_id}")
        assert res.status_code == 200
        job_data = res.json()
        if job_data["status"] in ["completed", "failed"]:
            final_bg_job = job_data
            break
        time.sleep(0.5)

    assert final_bg_job is not None, "Background replacement job timed out"
    assert final_bg_job["status"] == "completed", f"Background job failed: {final_bg_job.get('error')}"
    bg_photo_id = final_bg_job["output_photo_id"]
    print(f"[PASS] Background replacement finished: new photo_id={bg_photo_id}, url={final_bg_job['result_url']}")

    # 6. Passport processing (Complete workflow with fallback enabled)
    res = client.post("/api/photos/process-passport", json={"photo_id": bg_photo_id, "auto_fallback": True})
    assert res.status_code == 200, f"Process passport failed: {res.text}"
    pass_job = res.json()
    pass_job_id = pass_job["job_id"]
    print(f"[PASS] /api/photos/process-passport started: job_id={pass_job_id}")

    final_pass_job = None
    for _ in range(30):
        res = client.get(f"/api/jobs/{pass_job_id}")
        assert res.status_code == 200
        job_data = res.json()
        if job_data["status"] in ["completed", "failed"]:
            final_pass_job = job_data
            break
        time.sleep(0.5)

    assert final_pass_job is not None, "Passport job timed out"
    assert final_pass_job["status"] == "completed", f"Passport job failed: {final_pass_job.get('error')}"
    final_passport_photo_id = final_pass_job["output_photo_id"]
    print(f"[PASS] Passport photo finished: photo_id={final_passport_photo_id}, url={final_pass_job['result_url']}")

    # 7. Generate 4x6 Sheet with 8 copies of the processed passport photo
    res = client.post("/api/sheets/generate", json={
        "photos": [{"photo_id": final_passport_photo_id, "copies": 8}],
        "orientation": "landscape",
        "spacing_mm": 3.0,
        "margin_mm": 4.0,
        "cutting_guides": True,
        "bg_color": "#FFFFFF"
    })
    assert res.status_code == 200, f"Generate sheet failed: {res.text}"
    sheet_job = res.json()
    sheet_job_id = sheet_job["job_id"]

    final_sheet_job = None
    for _ in range(30):
        res = client.get(f"/api/jobs/{sheet_job_id}")
        assert res.status_code == 200
        job_data = res.json()
        if job_data["status"] in ["completed", "failed"]:
            final_sheet_job = job_data
            break
        time.sleep(0.5)

    assert final_sheet_job is not None, "Sheet generation timed out"
    assert final_sheet_job["status"] == "completed", f"Sheet generation failed: {final_sheet_job.get('error')}"
    sheet_id = final_sheet_job["sheet_id"]
    print(f"[PASS] 4x6 Sheet generated: sheet_id={sheet_id}, url={final_sheet_job['result_url']}")

    # 8. Download / View Sheet
    res = client.get(f"/api/sheets/{sheet_id}/view")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    print(f"[PASS] /api/sheets/{sheet_id}/view: returned {len(res.content)} bytes of JPEG")

    # 9. History and stats
    res = client.get("/api/history")
    assert res.status_code == 200
    history_items = res.json()
    assert len(history_items) >= 3
    print(f"[PASS] /api/history: retrieved {len(history_items)} logged jobs")

    res = client.get("/api/history/stats")
    assert res.status_code == 200
    stats = res.json()
    print(f"[PASS] /api/history/stats: total_photos={stats['total_photos_processed']}, today={stats['photos_processed_today']}, sheets={stats['total_sheets_generated']}")

    print("\n==========================================")
    print(">>> ALL END-TO-END INTEGRATION TESTS PASSED! <<<")
    print("==========================================\n")

if __name__ == "__main__":
    test_full_api_pipeline()
