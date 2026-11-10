from psd_tools import PSDImage
import numpy as np

psd_path = r"C:\photodesings\50 VOL 01 Birthday Anniversary Frame PSD\01(1).psd"
psd = PSDImage.open(psd_path)

print(f"{'Layer Name':<20} | {'Bbox':<28} | {'Size':<12} | {'Is Solid Black?'} | {'Alpha'} | {'Notes'}")
print("-" * 105)

for l in psd:
    if l.is_group() or getattr(l, "kind", None) == "type":
        continue
    bbox = getattr(l, "bbox", None)
    if not bbox:
        continue
    img = l.topil()
    if not img:
        continue
    
    # Check if solid black
    arr = np.array(img)
    is_solid_black = False
    alpha_info = "No alpha"
    if arr.ndim == 3 and arr.shape[2] == 4:
        r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
        opaque = a > 200
        alpha_info = f"({a.min()}, {a.max()})"
        if opaque.any():
            mean_rgb = (r[opaque].mean() + g[opaque].mean() + b[opaque].mean()) / 3
            std_rgb = (r[opaque].std() + g[opaque].std() + b[opaque].std()) / 3
            if mean_rgb < 15 and std_rgb < 10:
                is_solid_black = True
    elif arr.ndim == 3:
        if arr.mean() < 15 and arr.std() < 10:
            is_solid_black = True

    bw = bbox[2] - bbox[0]
    bh = bbox[3] - bbox[1]
    print(f"{l.name:<20} | {str(bbox):<28} | {f'{bw}x{bh}':<12} | {str(is_solid_black):<15} | {alpha_info:<12}")

