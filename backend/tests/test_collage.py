import sys
import os
import glob
import time
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from PIL import Image
from fastapi.testclient import TestClient
from app.main import app
from app.photo_layout.collage_engine import (
    birthday_collage_engine,
    A4_PORTRAIT_W,
    A4_PORTRAIT_H,
    A4_LANDSCAPE_W,
    A4_LANDSCAPE_H
)

client = TestClient(app)

def test_slot_calculations():
    print("Testing slot calculations for photo counts 2 to 20...")
    content_box = (100, 500, 2280, 2800)
    for count in [2, 3, 4, 5, 6, 8, 10, 12, 16, 20]:
        slots_hero = birthday_collage_engine.calculate_slots(count, content_box, template_id="hero_celebration")
        assert len(slots_hero) == count, f"Hero slots count mismatch for {count}: got {len(slots_hero)}"

        slots_mosaic = birthday_collage_engine.calculate_slots(count, content_box, template_id="balanced_mosaic")
        assert len(slots_mosaic) == count, f"Mosaic slots count mismatch for {count}: got {len(slots_mosaic)}"

    print("[PASS] Slot calculations validated for counts 2..20")


def test_collage_generation_portrait_and_landscape():
    print("Testing A4 portrait and landscape collage generation at 300 DPI...")
    sample_photos = glob.glob(r"C:\Users\hmath\Downloads\Photo\*.jpeg")
    assert len(sample_photos) >= 5, "Requires at least 5 sample photos"

    temp_out_portrait = "backend/outputs/test_portrait_300dpi.jpg"
    temp_out_landscape = "backend/outputs/test_landscape_300dpi.jpg"

    # Portrait 6 photos
    p_res = birthday_collage_engine.generate_birthday_collage(
        photo_paths=sample_photos[:6],
        output_path=temp_out_portrait,
        orientation="portrait",
        template_id="hero_celebration",
        theme_id="gold_luxury",
        title="HAPPY 5TH BIRTHDAY",
        name="ROHIT",
        subtitle="May all your dreams come true! • 2026"
    )
    img_p = Image.open(p_res)
    assert img_p.size == (A4_PORTRAIT_W, A4_PORTRAIT_H), f"Expected A4 portrait {A4_PORTRAIT_W}x{A4_PORTRAIT_H}, got {img_p.size}"
    assert img_p.info.get("dpi") == (300, 300), f"Expected 300 DPI, got {img_p.info.get('dpi')}"
    print(f"[PASS] A4 Portrait collage: size={img_p.size}, dpi={img_p.info.get('dpi')}")

    # Landscape 8 photos
    l_res = birthday_collage_engine.generate_birthday_collage(
        photo_paths=sample_photos[:8],
        output_path=temp_out_landscape,
        orientation="landscape",
        template_id="balanced_mosaic",
        theme_id="sky_celebration",
        title="HAPPY BIRTHDAY",
        name="ANANYA",
        subtitle="Celebrating a milestone year! • 2026"
    )
    img_l = Image.open(l_res)
    assert img_l.size == (A4_LANDSCAPE_W, A4_LANDSCAPE_H), f"Expected A4 landscape {A4_LANDSCAPE_W}x{A4_LANDSCAPE_H}, got {img_l.size}"
    assert img_l.info.get("dpi") == (300, 300), f"Expected 300 DPI, got {img_l.info.get('dpi')}"
    print(f"[PASS] A4 Landscape collage: size={img_l.size}, dpi={img_l.info.get('dpi')}")


def test_collage_api_endpoints():
    print("Testing /api/collage API endpoints...")

    # 1. Presets endpoint
    res = client.get("/api/collage/presets")
    assert res.status_code == 200
    presets = res.json()
    assert len(presets["templates"]) >= 3
    assert len(presets["themes"]) >= 5
    assert len(presets["fonts"]) >= 5
    print(f"[PASS] /api/collage/presets: {len(presets['templates'])} templates, {len(presets['themes'])} themes")

    # 2. Upload photos first
    sample_photos = glob.glob(r"C:\Users\hmath\Downloads\Photo\*.jpeg")[:4]
    uploaded_ids = []
    for sp in sample_photos:
        with open(sp, "rb") as f:
            up_res = client.post("/api/photos/upload", files={"files": ("test.jpeg", f, "image/jpeg")})
            assert up_res.status_code == 200
            uploaded_ids.append(up_res.json()["photos"][0]["photo_id"])

    assert len(uploaded_ids) == 4

    # 3. Generate collage via API
    gen_payload = {
        "photos": uploaded_ids,
        "orientation": "portrait",
        "template_id": "hero_celebration",
        "theme_id": "gold_luxury",
        "title": "HAPPY BIRTHDAY",
        "name": "KAVYA",
        "subtitle": "Sweet 16 Celebration!",
        "font_family": "georgia",
        "font_size_scale": 1.0,
        "show_decorations": True,
        "rounded_corners": True,
        "border_width": 8
    }

    res = client.post("/api/collage/generate", json=gen_payload)
    assert res.status_code == 200
    job_info = res.json()
    job_id = job_info["job_id"]
    collage_id = job_info["collage_id"]
    print(f"[PASS] /api/collage/generate initiated: job_id={job_id}, collage_id={collage_id}")

    # Poll until completed
    final_job = None
    for _ in range(30):
        res = client.get(f"/api/jobs/{job_id}")
        assert res.status_code == 200
        data = res.json()
        if data["status"] in ["completed", "failed"]:
            final_job = data
            break
        time.sleep(0.5)

    assert final_job is not None, "Collage generation timed out"
    assert final_job["status"] == "completed", f"Collage job failed: {final_job.get('error')}"
    print(f"[PASS] Collage job completed: url={final_job['result_url']}")

    # 4. View endpoint
    view_res = client.get(f"/api/collage/{collage_id}/view")
    assert view_res.status_code == 200
    assert view_res.headers["content-type"] == "image/jpeg"
    assert len(view_res.content) > 500000 # > 500KB JPEG
    print(f"[PASS] /api/collage/{collage_id}/view returned {len(view_res.content)} bytes of JPEG")

    # 5. Download endpoint
    dl_res = client.get(f"/api/collage/{collage_id}/download")
    assert dl_res.status_code == 200
    assert "attachment" in dl_res.headers.get("content-disposition", "")
    print(f"[PASS] /api/collage/{collage_id}/download verified")


if __name__ == "__main__":
    test_slot_calculations()
    test_collage_generation_portrait_and_landscape()
    test_collage_api_endpoints()
    print("\n=============================================")
    print(">>> ALL BIRTHDAY COLLAGE TESTS PASSED! <<<")
    print("=============================================\n")

