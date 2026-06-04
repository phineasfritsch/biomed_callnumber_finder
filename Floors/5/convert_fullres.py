import os
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()
SRC = r"C:\Users\phineasf\Documents\GitHub\biomed_callnumber_finder\Floors\5"
DST = os.path.join(SRC, "jpg")
os.makedirs(DST, exist_ok=True)

for n in range(289, 295):
    name = f"IMG_0{n}.HEIC"
    im = Image.open(os.path.join(SRC, name))
    im = ImageOps.exif_transpose(im).convert("RGB")
    out = os.path.join(DST, f"fullres_IMG_0{n}.jpg")
    im.save(out, "JPEG", quality=92)
    print(name, im.size, "->", out)
