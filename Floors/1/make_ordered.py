# Copy floor-1 JPGs into ordered/ with a zero-padded, call-number prefix.
# Non-destructive. IMG_3151 (duplicate of IMG_3150) is excluded via the CSV.
import os, csv, shutil

HERE = os.path.dirname(__file__)
JPG  = os.path.join(HERE, "jpg")
OUT  = os.path.join(HERE, "ordered")
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))

with open(os.path.join(HERE, "floor1_order.csv")) as f:
    rows = list(csv.DictReader(f))

for r in rows:
    n = int(r["order"])
    # compact start: drop the space inside "W2 AW4 D6P" etc. for a clean filename
    start_compact = r["start"].replace(" ", "-")
    src = os.path.join(JPG, r["image"] + ".jpg")
    dst = os.path.join(OUT, f"{n:02d}_{start_compact}_{r['image']}.jpg")
    shutil.copy2(src, dst)

print("wrote", len(rows), "ordered copies to", OUT)
for f in sorted(os.listdir(OUT)):
    print(" ", f)
