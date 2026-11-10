from psd_tools import PSDImage
from PIL import Image
import numpy as np

psd_path = r"C:\photodesings\50 VOL 01 Birthday Anniversary Frame PSD\01(1).psd"
psd = PSDImage.open(psd_path)

l_monika = [l for l in psd if l.name == "Monika"][0]
m_img = l_monika.topil()
print(f"l_monika topil size: {m_img.size}, mode: {m_img.mode}")
print(f"l_monika bbox: {l_monika.bbox}")
m_img.save(r"backend\inspect_monika_topil.png")

# Check where the non-zero alpha pixels of l_monika are:
arr = np.array(m_img)
alpha = arr[:, :, 3]
ys, xs = np.where(alpha > 0)
print(f"Non-zero alpha bounds within layer: x=[{xs.min()}, {xs.max()}], y=[{ys.min()}, {ys.max()}]")
print(f"Global bounds on canvas: x=[{l_monika.bbox[0] + xs.min()}, {l_monika.bbox[0] + xs.max()}], y=[{l_monika.bbox[1] + ys.min()}, {l_monika.bbox[1] + ys.max()}]")

