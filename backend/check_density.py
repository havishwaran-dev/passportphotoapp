from psd_tools import PSDImage
import numpy as np

psd_path = r"C:\photodesings\50 VOL 01 Birthday Anniversary Frame PSD\01(1).psd"
psd = PSDImage.open(psd_path)

print(f"{'Layer Name':<20} | {'Bbox':<28} | {'Size':<12} | {'Fill Density %':<16} | {'Is Photo Slot?'}")
print("-" * 90)

for l in psd:
    if l.is_group() or getattr(l, "kind", None) == "type":
        continue
    bbox = getattr(l, "bbox", None)
    if not bbox:
        continue
    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    if bw >= psd.width * 0.9 and bh >= psd.height * 0.9:
        continue # Canvas background
        
    img = l.topil()
    if not img:
        continue
        
    arr = np.array(img)
    if arr.ndim == 3 and arr.shape[2] == 4:
        a = arr[:, :, 3]
        opaque_count = np.sum(a > 128)
        total_pixels = a.size
        density = (opaque_count / total_pixels) * 100
    else:
        density = 100.0
        
    aspect = max(bw, bh) / max(1, min(bw, bh))
    is_slot = density >= 60.0 and bw >= 200 and bh >= 200 and aspect < 3.5
    print(f"{l.name:<20} | {str(bbox):<28} | {f'{bw}x{bh}':<12} | {f'{density:.1f}%':<16} | {str(is_slot)}")

