import os
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()
SRC = r"C:\Users\phineasf\Documents\GitHub\biomed_callnumber_finder\Floors\1"
DST = os.path.join(SRC, "jpg")
for n in (3188, 3189, 3190):
    im = Image.open(os.path.join(SRC, f"IMG_{n}.HEIC"))
    im = ImageOps.exif_transpose(im).convert("RGB")
    out = os.path.join(DST, f"fullres_IMG_{n}.jpg")
    im.save(out, "JPEG", quality=92)
    print(out, im.size)
