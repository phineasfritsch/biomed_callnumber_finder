# Sort floor-10 photos by call number. Mixed NLM (QW/QY/QZ) + LC (SB/SH) + NLM (W/WA-WJ).
# IMG_3288 label is printed END-on-top (same floor-start convention as floors 8/10);
# true ascending range: QW 4 S851b -> QW 16 S479.
import re, functools, csv, os

def parse(cn):
    toks = cn.upper().replace('*', '').split()
    m0 = re.match(r'^([A-Z]+)(\d*\.?\d*)$', toks[0])
    if not m0: return [('A', toks[0]), ('N', 0.0)]
    class_alpha = m0.group(1); rest = toks[1:]
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

# IMG_3288: label printed END-on-top; true range is QW 4 S851b -> QW 16 S479
data = {
    "IMG_3288": ("QW 4 S851b",    "QW 16 S479"),   # *-marked floor-start; label inverted
    "IMG_3289": ("QW 4 S875m",    "QW 52 O13"),
    "IMG_3290": ("QW 52 O31b",    "QW 165.5 P3"),
    "IMG_3291": ("QW 165.5 P6",   "QW 541 I33"),
    "IMG_3292": ("QW 541 I332",   "QW 900 I35"),
    "IMG_3293": ("QW 900 L668a",  "QY 50 C641"),
    "IMG_3294": ("QY 50 C768",    "QZ 4 W171P"),
    "IMG_3295": ("QZ 4 W883c",    "QZ 200 A179f"),
    "IMG_3296": ("QZ 200 A182c",  "QZ 202 M693"),
    "IMG_3297": ("QZ 202 M7176",  "QZ 269 P957"),
    "IMG_3298": ("QZ 269 P964",   "SB 933.37 I59"),
    "IMG_3299": ("SB 933.5 B419", "SH 174 P963"),
    "IMG_3300": ("SH 174 S933",   "W 13 D731"),
    "IMG_3301": ("W 13 D931da",   "W 20.5 M689"),
    "IMG_3302": ("W 20.5 M849t",  "W 49 H847"),
    "IMG_3303": ("W 49 H857d",    "W 74 D795s"),
    "IMG_3304": ("W 74 D795s",    "W 84 AA1"),
    "IMG_3305": ("W 84 AA1",      "W 89 M473"),
    "IMG_3306": ("W 89 M847C",    "W 867 I43"),
    "IMG_3307": ("W 867 I59L",    "WA 100 M451P"),
    "IMG_3308": ("WA 100 M4511",  "WA 305 S944M"),
    "IMG_3309": ("WA 305 T784",   "WA 440 L676S"),
    "IMG_3310": ("WA 440 M161w",  "WA 540 JV6"),
    "IMG_3311": ("WA 540 KA8",    "WA 689 U57m"),
    "IMG_3312": ("WA 689 U57p",   "WA 900.1 L334m"),
    "IMG_3313": ("WA 900.1 M297", "WB 39 M294"),
    "IMG_3314": ("WB 39 M294",    "WB 105 D636b"),
    "IMG_3315": ("WB 105 D794",   "WB 290 B598c"),
    "IMG_3316": ("WB 290 C641",   "WB 400 N9747"),
    "IMG_3317": ("WB 400 N9752",  "WB 925 I43"),
    "IMG_3318": ("WB 925 L315i",  "WC 450 M441h"),
    "IMG_3319": ("WC 450 M468",   "WC 840 C737"),
    "IMG_3320": ("WC 840 E18",    "WD 308 A2887"),
    "IMG_3321": ("WD 308 A28876", "WE 39 E92K"),
    "IMG_3322": ("WE 39 F789S",   "WE 168 S961"),
    "IMG_3323": ("WE 168 S961",   "WE 346 D758j"),
    "IMG_3324": ("WE 346 C154D",  "WE 707 C215"),  # row-weave: WE 346 C154D < WE 346 D758j
    "IMG_3325": ("WE 707 C215",   "WE 860 A2435"),
    "IMG_3326": ("WE 860 A244",   "WF 200 R352ti"),
    "IMG_3327": ("WF 200 S689t",  "WF 980 P964"),
    "IMG_3328": ("WF 980 R698p",  "WG 141 M9397"),
    "IMG_3329": ("WG 141 N487n",  "WG 200 H437"),
    "IMG_3330": ("WG 200 H437",   "WG 330 E383"),
    "IMG_3331": ("WG 330 E55",    "WH 100 E96"),
    "IMG_3332": ("WH 100 F962",   "WH 380 T231b"),
    "IMG_3333": ("WH 380 T255",   "WI 141 G2565"),
    "IMG_3334": ("WI 141 G2565",  "WI 702 L7845"),
    "IMG_3335": ("WI 702 L7845",  "WJ 140 O61"),
    "IMG_3336": ("WJ 140 P393",   "WJ 348 C616"),
}

order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

for img, (s, e) in data.items():
    if img == "IMG_3288": continue
    assert cmp(s, e) <= 0, f"REVERSED {img}: {s} > {e}"

rows = []
prev_end = None
print(f"{'#':>2}  {'image':10}  {'start':18} - {'end':18}  seam")
for i, (img, (s, e)) in enumerate(order, 1):
    if prev_end is None:
        seam = "(first)"
    else:
        c = cmp(prev_end, s)
        seam = "=EXACT=" if c == 0 else ("gap" if c < 0 else "OVERLAP (row weave)")
    note = " [*-label inverted]" if img == "IMG_3288" else ""
    print(f"{i:>2}  {img:10}  {s:18} - {e:18}  {seam}{note}")
    rows.append((i, img, s, e, seam))
    prev_end = e

out = os.path.join(os.path.dirname(__file__), "floor10_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["order","image","start","end","seam_from_prev"])
    w.writerows(rows)
print(f"\nwrote {out} | ordered: {len(rows)} | range: {order[0][1][0]} -> {order[-1][1][1]}")
