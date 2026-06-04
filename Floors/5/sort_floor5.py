# Order floor-5 shelf-end photos by library call number.
# Uses the decimal comparator from Instructions.txt (digits after a letter
# group are a DECIMAL fraction, so AM4733 < AM477).
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

# image -> (start, end), exactly as printed (GE 191 normalized to GE191)
data = {
    "IMG_0254": ("W1 ER511",  "W1 EU726"),
    "IMG_0255": ("W1 EN996D", "W1 ER511"),
    "IMG_0256": ("W1 EC899",  "W1 EM647"),
    "IMG_0257": ("W1 DO181",  "W1 EC899"),
    "IMG_0258": ("W1 DE926",  "W1 DE957"),
    "IMG_0259": ("W1 DE244",  "W1 DE918"),
    "IMG_0260": ("W1 D116",   "W1 DE244"),
    "IMG_0261": ("W1 DE957",  "W1 DI197"),
    "IMG_0262": ("W1 DI197",  "W1 DO181"),
    "IMG_0263": ("W1 EM647",  "W1 EN197"),
    "IMG_0264": ("W1 EN197",  "W1 EN996D"),
    "IMG_0265": ("W1 EU726",  "W1 EU733M"),
    "IMG_0266": ("W1 EU733M", "W1 EU736"),
    "IMG_0267": ("W1 EU736",  "W1 EV275"),
    "IMG_0268": ("W1 EV275",  "W1 EX597"),
    "IMG_0269": ("W1 EX597",  "W1 EX623"),
    "IMG_0270": ("W1 EX623",  "W1 FA471"),
    "IMG_0271": ("W1 FA471",  "W1 FE119"),
    "IMG_0272": ("W1 FE134",  "W1 FL302B"),
    "IMG_0273": ("W1 FL957",  "W1 GA361"),
    "IMG_0274": ("W1 GA361",  "W1 GE179"),
    "IMG_0275": ("W1 GE191",  "W1 GE276"),   # label printed "W1 GE 191"
    "IMG_0276": ("W1 GE278",  "W1 GE383"),
    "IMG_0277": ("W1 GE383",  "W1 GR845"),
    "IMG_0278": ("W1 GR845",  "W1 HE121"),
    "IMG_0302": ("W1 HE131",  "W1 HE548"),
    "IMG_0301": ("W1 HE549",  "W1 HE925"),
    "IMG_0279": ("W1 HE925",  "W1 HI703"),
    "IMG_0280": ("W1 HI703",  "W1 HO681"),
    "IMG_0300": ("W1 HO631",  "W1 HU440"),
    "IMG_0299": ("W1 HU440",  "W1 HU471"),
    "IMG_0281": ("W1 HU470",  "W1 IB375"),
    "IMG_0282": ("W1 IB375",  "W1 IM547"),
    "IMG_0298": ("W1 IM547A", "W1 IN236"),
    "IMG_0297": ("W1 IN236",  "W1 IN3892"),
    "IMG_0283": ("W1 IN394",  "W1 IN589P"),
    "IMG_0285": ("W1 IN474",  "W1 IN7661"),
    "IMG_0284": ("W1 IN593",  "W1 IN747"),
    "IMG_0286": ("W1 IN7661A","W1 IN778"),
    "IMG_0296": ("W1 IN778",  "W1 IN7886"),
    "IMG_0287": ("W1 IN7886", "W1 IN795"),
    "IMG_0288": ("W1 IN798",  "W1 IN828"),
    "IMG_0295": ("W1 IN998",  "W1 IZ764"),
}

# sort by start, then end
order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

# sanity: every range start <= end
for img, (s, e) in data.items():
    assert cmp(s, e) <= 0, f"REVERSED {img}: {s} > {e}"

rows = []
prev_end = None
print(f"{'#':>2}  {'image':10}  {'start':10} - {'end':10}   seam-from-prev")
for i, (img, (s, e)) in enumerate(order, 1):
    if prev_end is None:
        seam = "(first)"
    else:
        c = cmp(prev_end, s)
        seam = "=EXACT=" if c == 0 else ("gap" if c < 0 else "OVERLAP (row weave)")
    print(f"{i:>2}  {img:10}  {s:10} - {e:10}   {seam}")
    rows.append((i, img, s, e, seam))
    prev_end = e

out = os.path.join(os.path.dirname(__file__), "floor5_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["order", "image", "start", "end", "seam_from_prev"])
    w.writerows(rows)
print("\nwrote", out)
print("ordered:", len(rows), "| blank/no-label (set aside):",
      "IMG_0289, IMG_0290, IMG_0291, IMG_0292, IMG_0293, IMG_0294")
