from psd_tools import PSDImage

psd_path = r"C:\photodesings\50 VOL 01 Birthday Anniversary Frame PSD\01(1).psd"
psd = PSDImage.open(psd_path)

bg_layer = [l for l in psd if l.name == "Background"][0]
bg_img = bg_layer.topil()

# Check what is inside the Background layer around the Monika bbox (869, 3228, 1343, 3349)
crop_bg = bg_img.crop((800, 3100, 1400, 3400))
print("Background layer crop size:", crop_bg.size)
print("Background layer crop extrema:", crop_bg.getextrema())
crop_bg.save(r"backend\inspect_bg_monika.png")

# Now check the embedded composite (psd.topil())
comp_img = psd.topil()
crop_comp = comp_img.crop((800, 3100, 1400, 3400))
print("Composite crop extrema:", crop_comp.getextrema())
crop_comp.save(r"backend\inspect_comp_monika.png")

print("Saved inspect_bg_monika.png and inspect_comp_monika.png")

