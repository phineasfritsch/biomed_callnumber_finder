# Sort floor-8 photos by NLM call number.
# Floor 8 uses the NLM scheme (class letters + class number + Cutters).
# IMG_3198 has its label printed END-on-top (the *-marked floor-start bottom shelf);
# its true ascending range is WJ 752 P968 -> WK 835 V3315.
# IMG_3229 is missing from the set — the seam between 3228/3230 is tight
# (WS 200 P3706 / WS 200 P3707), so nothing was photographed there.
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

# IMG_3198: label printed END-on-top; stored here as (true start, true end)
data = {
    "IMG_3198": ("WJ 752 P968",    "WK 835 V3315"),  # *-marked floor-start shelf; label shows end/start reversed
    "IMG_3199": ("WJ 752 Q5",      "WK 400 S961"),
    "IMG_3200": ("WK 400 T5465",   "WL 20 N277I"),
    "IMG_3201": ("WL 20 N494",     "WL 102 B8137"),
    "IMG_3202": ("WL 102 B814",    "WL 102.8 N279N"),
    "IMG_3203": ("WL 102.8 N398",  "WL 141 E195"),
    "IMG_3204": ("WL 141 E38",     "WL 310 R438"),
    "IMG_3205": ("WL 310 S838B",   "WL 355 C416"),
    "IMG_3206": ("WL 355 C4176",   "WL 400 A468D"),
    "IMG_3207": ("WL 400 A517S",   "WM 13 D5536"),
    "IMG_3208": ("WM 13 D5537",    "WM 33 AA1"),
    "IMG_3209": ("WM 33 AA1",      "WM 100 D299A"),
    "IMG_3210": ("WM 100 D299A",   "WM 141 I24E"),
    "IMG_3211": ("WM 141 I31",     "WM 172 C968"),
    "IMG_3212": ("WM 172 C9763",   "WM 190 P232P"),
    "IMG_3213": ("WM 190 P232S",   "WM 220 C737"),
    "IMG_3214": ("WM 220 C748",    "WM 274 C466U"),
    "IMG_3215": ("WM 274 C536",    "WM 415 L469C"),
    "IMG_3216": ("WM 415 L989",    "WM 420 W836P"),
    "IMG_3217": ("WM 420 W848H",   "WM 450.5 M8"),
    "IMG_3218": ("WM 450.5 M8",    "WM 460.5 P3"),
    "IMG_3219": ("WM 460.5 P3",    "WN 110 P8958"),
    "IMG_3220": ("WN 110 S468B",   "WN 620 C881R"),
    "IMG_3221": ("WN 620 C964H",   "WO 245 M294"),
    "IMG_3222": ("WO 245 M295",    "WO 925 P371"),
    "IMG_3223": ("WO 925 P3714",   "WP 570 T255"),
    "IMG_3224": ("WP 570 T783",    "WQ 200 A629"),
    "IMG_3225": ("WQ 200 B171P",   "WQ 300 Y69C"),
    "IMG_3226": ("WQ 305 D576",    "WS 17 C719"),
    "IMG_3227": ("WS 17 D993C",    "WS 105.5 C7"),
    "IMG_3228": ("WS 105.5 C7",    "WS 200 P3706"),
    # IMG_3229 missing; seam 3228→3230 is P3706/P3707 (no gap)
    "IMG_3230": ("WS 200 P3707",   "WS 350 G741C"),
    "IMG_3231": ("WS 350 G815P",   "WS 420 H233H"),
    "IMG_3232": ("WS 420 H236",    "WT 100 F946A"),
    "IMG_3233": ("WT 100 F981",    "WU 18 C678E"),
    "IMG_3234": ("WU 18 C739",     "WU 240 G491C"),
    "IMG_3235": ("WU 240 G155P",   "WV 100 S4313"),
    "IMG_3236": ("WV 100 S4313",   "WV 540 S961"),
    "IMG_3237": ("WV 540 T892S",   "WW 145 L137P"),
    "IMG_3238": ("WW 145 M718",    "WW 400 W168C"),
    "IMG_3239": ("WW 400 W168C",   "WX 155 H434"),
    "IMG_3240": ("WX 155 K88R",    "WY 16 A652"),
    "IMG_3241": ("WY 16 B469E",    "WY 33 AA1"),
    "IMG_3242": ("WY 33 AA1",      "WY 100 F97984"),
    "IMG_3243": ("WY 100 F97984",  "WY 150 A497"),
    "IMG_3244": ("WY 150 A846",    "WY 157.3 D547M"),
    "IMG_3245": ("WY 157.3 D651M", "Z 675 H7"),
    "IMG_3246": ("Z 675 H7 D628",  "ZQV 38 H335D"),
    "IMG_3247": ("ZQV 77.7 A139",  "ZWZ 112 M889"),
}

order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

for img, (s, e) in data.items():
    if img == "IMG_3198": continue  # inverted label — skip normal check
    assert cmp(s, e) <= 0, f"REVERSED {img}: {s} > {e}"

rows = []
prev_end = None
print(f"{'#':>2}  {'image':10}  {'start':15} - {'end':16}  seam-from-prev")
for i, (img, (s, e)) in enumerate(order, 1):
    if prev_end is None:
        seam = "(first)"
    else:
        c = cmp(prev_end, s)
        seam = "=EXACT=" if c == 0 else ("gap" if c < 0 else "OVERLAP (row weave)")
    note = " [*-label inverted]" if img == "IMG_3198" else ""
    print(f"{i:>2}  {img:10}  {s:15} - {e:16}  {seam}{note}")
    rows.append((i, img, s, e, seam))
    prev_end = e

out = os.path.join(os.path.dirname(__file__), "floor8_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["order","image","start","end","seam_from_prev"])
    w.writerows(rows)
print(f"\nwrote {out} | ordered: {len(rows)} | missing: IMG_3229 (no call-number gap)")
print(f"range: {order[0][1][0]} -> {order[-1][1][1]}")
