# Copy floor-3 JPGs into ordered/ with a zero-padded, call-number prefix.
# Non-destructive. Only the 48 entries in floor3_order.csv are copied
# (blank IMG_2999 and duplicates IMG_2984(1)/IMG_3064 are excluded).
import os, csv, shutil

HERE = os.path.dirname(__file__)
JPG  = os.path.join(HERE, "jpg")
OUT  = os.path.join(HERE, "ordered")
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))

with open(os.path.join(HERE, "floor3_order.csv")) as f:
    rows = list(csv.DictReader(f))

for r in rows:
    n = int(r["order"])
    start_compact = r["start"].replace("W1 ", "").replace(" ", "")
    src = os.path.join(JPG, r["image"] + ".jpg")
    dst = os.path.join(OUT, f"{n:02d}_{start_compact}_{r['image']}.jpg")
    shutil.copy2(src, dst)

print("wrote", len(rows), "ordered copies to", OUT)
for f in sorted(os.listdir(OUT)):
    print(" ", f)
