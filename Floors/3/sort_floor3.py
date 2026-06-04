# Order floor-3 shelf-end photos by library call number (W1 scheme, J/K/L cutters).
# Decimal comparator from Instructions.txt (JO5221 = .5221 < JO523 = .523).
import re, functools, csv, os

def parse(cn):
    toks = cn.upper().replace('*', '').split()
    m0 = re.match(r'^([A-Z]+)(\d*\.?\d*)$', toks[0])
    class_alpha = m0.group(1)
    rest = toks[1:]
    if m0.group(2):
        class_num = float(m0.group(2))
    elif rest and re.match(r'^\d+\.?\d*$', rest[0]):
        class_num = float(rest[0]); rest = rest[1:]
    else:
        class_num = 0.0
    comp = [('A', class_alpha), ('N', class_num)]
    for t in rest:
        mm = re.match(r'^([A-Z]+)(\d*)([A-Z]*)$', t)
        if mm:
            a, d, sfx = mm.groups()
            comp.append(('C', a, float('0.' + d) if d else 0.0, sfx))
        else:
            comp.append(('C', t, 0.0, ''))
    return comp

def cmp(x, y):
    a, b = parse(x), parse(y)
    for i in range(max(len(a), len(b))):
        if i >= len(a): return -1
        if i >= len(b): return 1
        if a[i] != b[i]: return -1 if a[i] < b[i] else 1
    return 0

# image -> (start, end). Spaces in printed labels normalized (JO 5221 -> JO5221).
# IMG_3063 is the back wall with TWO half-shelf labels in one photo; represented
# by its overall span JA121..JO5221 (sorts first).
data = {
    "IMG_3063": ("W1 JA121",   "W1 JO5221"),   # back wall: JA121-JO506 + JO506-JO5221
    "IMG_2967": ("W1 JO5221",  "W1 JO523"),
    "IMG_2966": ("W1 JO523",   "W1 JO535"),
    "IMG_2965": ("W1 JO535",   "W1 JO542"),
    "IMG_2968": ("W1 JO542",   "W1 JO542"),
    "IMG_2969": ("W1 JO542",   "W1 JO547"),
    "IMG_2964": ("W1 JO547",   "W1 JO551V"),
    "IMG_2963": ("W1 JO551V",  "W1 JO5576"),
    "IMG_2970": ("W1 JO5576",  "W1 JO565"),
    "IMG_2971": ("W1 JO565",   "W1 JO567"),
    "IMG_2962": ("W1 JO567",   "W1 JO572"),
    "IMG_2961": ("W1 JO572",   "W1 JO599"),
    "IMG_2972": ("W1 JO599",   "W1 JO6204"),
    "IMG_2973": ("W1 JO6204",  "W1 JO623ML"),
    "IMG_2974": ("W1 JO623MP", "W1 JO626"),
    "IMG_2975": ("W1 JO626",   "W1 JO629B"),
    "IMG_2976": ("W1 JO6292",  "W1 JO632"),
    "IMG_2977": ("W1 JO632",   "W1 JO6386"),
    "IMG_2978": ("W1 JO639N",  "W1 JO650"),
    "IMG_2979": ("W1 JO650",   "W1 JO656"),
    "IMG_2980": ("W1 JO656",   "W1 JO669"),
    "IMG_2981": ("W1 JO669",   "W1 JO682"),
    "IMG_2982": ("W1 JO682",   "W1 JO6907"),
    "IMG_2983": ("W1 JO6907",  "W1 JO701"),
    "IMG_2984": ("W1 JO701",   "W1 JO714"),
    "IMG_2985": ("W1 JO714",   "W1 JO718D"),
    "IMG_3011": ("W1 JO718L",  "W1 JO728"),
    "IMG_3010": ("W1 JO728",   "W1 JO7403"),
    "IMG_2986": ("W1 JO7403",  "W1 JO742H"),
    "IMG_2988": ("W1 JO742L",  "W1 JO756"),
    "IMG_3009": ("W1 JO757",   "W1 JO788"),
    "IMG_3008": ("W1 JO788",   "W1 JO796"),
    "IMG_2989": ("W1 JO797",   "W1 JO819"),
    "IMG_2990": ("W1 JO819",   "W1 JO829"),
    "IMG_3007": ("W1 JO829",   "W1 JO836"),
    "IMG_3006": ("W1 JO836",   "W1 JO852"),
    "IMG_2992": ("W1 JO886",   "W1 JO897VL"),
    "IMG_2993": ("W1 JO897VL", "W1 JO913"),
    "IMG_2994": ("W1 JO913",   "W1 JO922F"),
    "IMG_3005": ("W1 JO922F",  "W1 JO939"),
    "IMG_2995": ("W1 JO939",   "W1 JO955"),
    "IMG_2996": ("W1 JO955",   "W1 KI311"),
    "IMG_3004": ("W1 KI311",   "W1 LA208"),
    "IMG_3003": ("W1 LA208",   "W1 LA534"),
    "IMG_2997": ("W1 LA534",   "W1 LA719"),
    "IMG_2998": ("W1 LA719",   "W1 LI388"),
    "IMG_3002": ("W1 LI431",   "W1 LY621"),
    "IMG_3001": ("W1 LY621",   "W1 LY627"),
}

order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

for img, (s, e) in data.items():
    assert cmp(s, e) <= 0, f"REVERSED {img}: {s} > {e}"

rows = []
prev_end = None
print(f"{'#':>2}  {'image':10}  {'start':11} - {'end':11}   seam-from-prev")
for i, (img, (s, e)) in enumerate(order, 1):
    if prev_end is None:
        seam = "(first)"
    else:
        c = cmp(prev_end, s)
        seam = "=EXACT=" if c == 0 else ("gap" if c < 0 else "OVERLAP (row weave)")
    print(f"{i:>2}  {img:10}  {s:11} - {e:11}   {seam}")
    rows.append((i, img, s, e, seam))
    prev_end = e

out = os.path.join(os.path.dirname(__file__), "floor3_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["order", "image", "start", "end", "seam_from_prev"])
    w.writerows(rows)
print("\nwrote", out, "| ordered:", len(rows))
print("set aside -> blank: IMG_2999 | duplicates: IMG_2984(1)=IMG_2984, IMG_3064=IMG_2993")
print("note: IMG_3063 is the back wall, two labels in one photo (JA121-JO506, JO506-JO5221)")
