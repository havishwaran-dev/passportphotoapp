import os
import sys
from pathlib import Path
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config.settings import get_settings
from app.photoshop.photoshop_service import photoshop_service
from app.image_processing.background_remover import hex_to_rgb
from app.photo_layout.sheet_generator import sheet_generator
from app.services.job_manager import job_manager

def test_settings():
    s = get_settings()
    assert s.passport_width_mm == 35.0
    assert s.passport_height_mm == 45.0
    assert s.dpi == 300
    print("[PASS] Settings test passed")

def test_hex_to_rgb():
    assert hex_to_rgb("#0080FF") == (0, 128, 255)
    assert hex_to_rgb("#FFFFFF") == (255, 255, 255)
    assert hex_to_rgb("#000000") == (0, 0, 0)
    print("[PASS] Hex to RGB test passed")

def test_grid_calculation():
    # 6x4 inch at 300 DPI: 1800 x 1200 px
    # 35x45 mm at 300 DPI: 413 x 531 px
    grid = sheet_generator.calculate_grid(
        sheet_w_px=1800,
        sheet_h_px=1200,
        photo_w_px=413,
        photo_h_px=531,
        spacing_px=35,
        margin_px=47
    )
    assert grid["cols"] >= 3
    assert grid["rows"] >= 2
    assert grid["total_slots"] >= 6
    print(f"[PASS] Grid calculation passed: cols={grid['cols']}, rows={grid['rows']}, total_slots={grid['total_slots']}")

def test_photoshop_service_status():
    status = photoshop_service.get_status()
    assert "photoshop_installed" in status
    assert "skinfiner_installed" in status
    assert "action_file_exists" in status
    print(f"[PASS] Photoshop status probe passed: PS Installed={status['photoshop_installed']}, SkinFiner={status['skinfiner_installed']}, Action Exists={status['action_file_exists']}")

def test_native_enhancement_and_sheet():
    temp_dir = Path(__file__).resolve().parent / "temp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    # Create test input image
    test_img = Image.new("RGB", (600, 800), color=(180, 150, 130))
    in_path = temp_dir / "test_in.jpg"
    test_img.save(in_path)
    
    # Test native passport enhancement
    out_passport = temp_dir / "test_passport_out.jpg"
    photoshop_service.native_studio_enhancement(str(in_path), str(out_passport))
    assert out_passport.exists()
    
    with Image.open(out_passport) as im:
        assert im.size == (413, 531)
        print(f"[PASS] Native studio passport enhancement passed: size={im.size}")

    # Test sheet generation with this photo (8 copies)
    out_sheet = temp_dir / "test_sheet_out.jpg"
    res = sheet_generator.generate_sheet(
        photos=[{"path": str(out_passport), "copies": 8}],
        output_path=str(out_sheet),
        orientation="landscape"
    )
    assert out_sheet.exists()
    with Image.open(out_sheet) as im:
        assert im.size == (1800, 1200)
        print(f"[PASS] 4x6 Sheet generation passed: size={im.size}, photos_placed={res['photos_placed']}")

    # Clean up test files
    for p in [in_path, out_passport, out_sheet]:
        try:
            if p.exists(): p.unlink()
        except: pass

def test_job_manager():
    job = job_manager.create_job(mode="passport", meta={"test": True})
    assert job.status == "waiting"
    job_manager.update_job(job.id, status="completed", progress=100, message="Done")
    retrieved = job_manager.get_job(job.id)
    assert retrieved.status == "completed"
    assert retrieved.progress == 100
    print("[PASS] Job manager test passed")

if __name__ == "__main__":
    print("\n--- Running PJK Studio Backend Tests ---")
    test_settings()
    test_hex_to_rgb()
    test_grid_calculation()
    test_photoshop_service_status()
    test_native_enhancement_and_sheet()
    test_job_manager()
    print("--- ALL BACKEND TESTS PASSED ---\n")
