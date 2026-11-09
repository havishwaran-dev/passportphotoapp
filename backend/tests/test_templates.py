import os
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from app.main import app
from app.services.template_service import template_service

client = TestClient(app)

def test_template_indexing():
    print("Testing template indexing...")
    categories = template_service.get_categories()
    assert len(categories) > 0, "No categories discovered"
    print(f"[PASS] Discovered {len(categories)} categories. Top: {categories[0]['name']} ({categories[0]['count']} PSDs)")

    # List templates
    res = template_service.list_templates(limit=5)
    assert res["total"] > 0, "Total templates count is 0"
    assert len(res["templates"]) > 0, "No templates returned"
    print(f"[PASS] Listed templates successfully: total={res['total']}, sample={res['templates'][0]['name']}")

def test_template_api_endpoints():
    print("Testing template API endpoints...")
    # 1. Categories endpoint
    r = client.get("/api/templates/categories")
    assert r.status_code == 200
    data = r.json()
    assert "categories" in data
    assert len(data["categories"]) > 0
    print(f"[PASS] /api/templates/categories returned {len(data['categories'])} categories")

    # 2. List templates endpoint
    r = client.get("/api/templates?limit=4")
    assert r.status_code == 200
    t_data = r.json()
    assert t_data["total"] > 0
    assert len(t_data["templates"]) == 4
    tid = t_data["templates"][0]["template_id"]
    print(f"[PASS] /api/templates limit=4 returned 4 items. Sample TID: {tid}")

    # 3. Details endpoint
    r = client.get(f"/api/templates/{tid}/details")
    assert r.status_code == 200
    detail = r.json()
    assert "photo_slots" in detail
    assert "text_slots" in detail
    print(f"[PASS] /api/templates/{tid}/details returned {len(detail['photo_slots'])} photo slots, {len(detail['text_slots'])} text slots")

    # 4. Preview endpoint
    r = client.get(f"/api/templates/{tid}/preview")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert len(r.content) > 1000
    print(f"[PASS] /api/templates/{tid}/preview returned {len(r.content)} bytes of JPEG")

def test_template_generation_pipeline():
    print("Testing template customization and output generation...")
    # Create a test customer photo in uploads
    temp_dir = Path("backend/uploads")
    temp_dir.mkdir(parents=True, exist_ok=True)
    test_photo = Image.new("RGB", (800, 1000), color=(50, 120, 220))
    test_photo_path = temp_dir / "test_cust_photo.jpg"
    test_photo.save(test_photo_path)

    # Use first available template
    res = template_service.list_templates(limit=1)
    tid = res["templates"][0]["template_id"]
    detail = template_service.inspect_template_details(tid)

    photo_slot_name = detail["photo_slots"][0]["layer_name"] if detail["photo_slots"] else "Main Photo Slot"
    text_slot_name = detail["text_slots"][0]["layer_name"] if detail["text_slots"] else "NAME"

    req_payload = {
        "template_id": tid,
        "photo_assignments": [
            {"slot_name": photo_slot_name, "photo_id": "test_cust_photo.jpg"}
        ],
        "text_assignments": [
            {"layer_name": text_slot_name, "text": "PJK XEROX TESTING"}
        ],
        "engine": "fast_studio",
        "jpeg_quality": 90
    }

    r = client.post("/api/templates/generate", json=req_payload)
    assert r.status_code == 200, f"Generate failed: {r.text}"
    job = r.json()
    job_id = job["job_id"]
    print(f"[PASS] /api/templates/generate initiated job_id: {job_id}")

    # Poll job
    import time
    final_job = None
    for _ in range(30):
        rj = client.get(f"/api/jobs/{job_id}")
        assert rj.status_code == 200
        jd = rj.json()
        if jd["status"] in ["completed", "failed"]:
            final_job = jd
            break
        time.sleep(0.3)

    assert final_job is not None, "Job timed out"
    assert final_job["status"] == "completed", f"Job failed: {final_job.get('error')}"
    print(f"[PASS] Template generation completed! Output URL: {final_job['result_url']}")

    # Verify download
    r_dl = client.get(final_job["result_url"])
    assert r_dl.status_code == 200
    assert len(r_dl.content) > 10000
    print(f"[PASS] Download verified: {len(r_dl.content)} bytes of high-res print JPEG")

if __name__ == "__main__":
    print("\n==========================================")
    print(">>> RUNNING PSD TEMPLATE STUDIO TESTS <<<")
    print("==========================================")
    test_template_indexing()
    test_template_api_endpoints()
    test_template_generation_pipeline()
    print("\n==========================================")
    print(">>> ALL PSD TEMPLATE TESTS PASSED! <<<")
    print("==========================================")
