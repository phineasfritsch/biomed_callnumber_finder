import os, sys
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()

SRC = r"C:\Users\phineasf\Documents\GitHub\biomed_callnumber_finder\Floors\2"
DST = os.path.join(SRC, "jpg")
os.makedirs(DST, exist_ok=True)

args = sys.argv[1:]
files = args if args else sorted(f for f in os.listdir(SRC) if f.lower().endswith(".heic"))

MAXEDGE = 2000

for name in files:
    src = os.path.join(SRC, name)
    base = os.path.splitext(name)[0]
    dst = os.path.join(DST, base + ".jpg")
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    w, h = im.size
    scale = min(1.0, MAXEDGE / max(w, h))
    if scale < 1.0:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    im = im.convert("RGB")
    im.save(dst, "JPEG", quality=88)
    print(f"{name} {w}x{h} -> {base}.jpg ({im.size[0]}x{im.size[1]})")
