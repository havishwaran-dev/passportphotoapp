from psd_tools import PSDImage
from PIL import Image, ImageDraw
import numpy as np

psd_path = r"C:\photodesings\50 VOL 01 Birthday Anniversary Frame PSD\01(1).psd"
psd = PSDImage.open(psd_path)
canvas = psd.topil().convert("RGB")

l_monika = [l for l in psd if l.name == "Monika"][0]
tx1, ty1, tx2, ty2 = l_monika.bbox
print(f"Monika bbox: ({tx1}, {ty1}, {tx2}, {ty2}), size = {tx2 - tx1} x {ty2 - ty1}")

# Let's crop slightly padded area
pad = 20
crop_padded = canvas.crop((tx1 - pad, ty1 - pad, tx2 + pad, ty2 + pad))
crop_padded.save(r"backend\inspect_monika_exact.png")

# Now let's test clearing with a rectangle with pad=10
test_canvas = canvas.copy()
draw = ImageDraw.Draw(test_canvas)
draw.rectangle([tx1 - 10, ty1 - 10, tx2 + 10, ty2 + 10], fill=(255, 255, 255))
test_crop = test_canvas.crop((tx1 - pad, ty1 - pad, tx2 + pad, ty2 + pad))
test_crop.save(r"backend\inspect_monika_cleared.png")

# Check if any black pixels remain in that area
arr = np.array(test_crop)
dark_pixels = np.sum(arr < 200)
print(f"Dark pixels remaining after clear with pad=10: {dark_pixels}")

