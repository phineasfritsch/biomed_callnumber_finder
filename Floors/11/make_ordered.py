import os, csv, shutil
HERE = os.path.dirname(__file__)
JPG = os.path.join(HERE, "jpg"); OUT = os.path.join(HERE, "ordered")
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
with open(os.path.join(HERE, "floor11_order.csv")) as f:
    rows = list(csv.DictReader(f))
for r in rows:
    n = int(r["order"]); s = r["start"].replace(" ", "-")
    shutil.copy2(os.path.join(JPG, r["image"]+".jpg"),
                 os.path.join(OUT, f"{n:02d}_{s}_{r['image']}.jpg"))
print(f"wrote {len(rows)} copies to {OUT}")
for f in sorted(os.listdir(OUT)): print(" ", f)
