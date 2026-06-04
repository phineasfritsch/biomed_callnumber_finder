import os, sys
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()

SRC = r"C:\Users\phineasf\Documents\GitHub\biomed_callnumber_finder\Floors\5"
DST = os.path.join(SRC, "jpg")
os.makedirs(DST, exist_ok=True)

# Optional: pass filenames as args; otherwise convert all HEIC in folder.
args = sys.argv[1:]
if args:
    files = args
else:
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".heic"))

MAXEDGE = 2000  # cap long edge so labels stay legible but files stay manageable

for name in files:
    src = os.path.join(SRC, name)
    base = os.path.splitext(name)[0]
    dst = os.path.join(DST, base + ".jpg")
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)  # respect orientation
    w, h = im.size
    scale = min(1.0, MAXEDGE / max(w, h))
    if scale < 1.0:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    im = im.convert("RGB")
    im.save(dst, "JPEG", quality=88)
    print(f"{name} {w}x{h} -> {dst} ({im.size[0]}x{im.size[1]})")
