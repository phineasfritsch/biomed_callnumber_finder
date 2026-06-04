# Build a clean, human-readable shelf-range list for floor 3 from floor3_order.csv.
# - IMG_3063 (back wall) is split into its two real ranges.
# - The user-confirmed missing-shelf gap (JO852 -> JO886) is marked.
import csv, os

HERE = os.path.dirname(__file__)
with open(os.path.join(HERE, "floor3_order.csv")) as f:
    rows = list(csv.DictReader(f))

# expand into (start, end, note) range-lines
ranges = []
for r in rows:
    img = r["image"]
    if img == "IMG_3063":
        ranges.append(("W1 JA121", "W1 JO506",  f"{img}, back wall 1/2"))
        ranges.append(("W1 JO506", "W1 JO5221", f"{img}, back wall 2/2"))
    else:
        ranges.append((r["start"], r["end"], img))

lines = []
lines.append("Floor 3 - Biomed Stacks: shelf ranges in library call-number order")
lines.append(f"W1 scheme (J-L cutters). {len(ranges)} shelf faces from {len(rows)} photos.")
lines.append("Sorted with the decimal call-number comparator; one known gap (marked).")
lines.append("")

for i, (s, e, note) in enumerate(ranges, 1):
    lines.append(f"{i:>3}.  {s:<11}- {e:<11}  [{note}]")
    if e == "W1 JO852":  # user-confirmed: next shelf was not photographed
        lines.append("      - - - - gap: W1 JO852 to W1 JO886 not photographed - - - -")

text = "\n".join(lines) + "\n"
out = os.path.join(HERE, "floor3_list.txt")
with open(out, "w", encoding="utf-8") as f:
    f.write(text)
print(text)
print("wrote", out)
