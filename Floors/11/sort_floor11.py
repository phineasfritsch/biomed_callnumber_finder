# Sort floor-11 photos by call number. LC scheme: AG, BF, H, HM, HQ, PE, QC, QE,
# QH, QK, QL, QS, QT, QU, QV.
# Labels have "LEVEL 11" header (visible on IMG_3337 and IMG_3338).
# IMG_3338: start "BF 38 G952p" was crossed out; correct start is "BF 57 F72c"
#   (handwritten on label; confirmed by user).
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

data = {
    "IMG_3337": ("AG 5 N421",         "BF 57 D53"),       # *-marked floor start (LEVEL 11 header)
    "IMG_3338": ("BF 57 F72c",        "BF 311 C6766"),    # LEVEL 11; start corrected (BF 38 G952p crossed out -> BF 57 F72c)
    "IMG_3339": ("BF 311 C6767",      "BF 371 B141h"),
    "IMG_3340": ("BF 371 B141p",      "BF 455 D646v"),
    "IMG_3341": ("BF 455 E36p",       "BF 575 S37 G373t"),
    "IMG_3342": ("BF 575 P9 R951p",   "BF 697 P975"),     # row-weave: P9 < S37
    "IMG_3343": ("BF 697 R277a",      "BF 713 T65"),
    "IMG_3344": ("BF 713 T655b",      "BF 789 D4 6456s"),
    "IMG_3345": ("BF 789 D4",         "H 62 B113s"),      # row-weave: BF 789 D4 < BF 789 D4 6456s
    "IMG_3346": ("H 62 B113s",        "HM 271 M598o"),
    "IMG_3347": ("HM 271 M598o",      "HQ 1090 D754m"),
    "IMG_3348": ("HQ 1090 M452m",     "PE 1628 W39c"),
    "IMG_3349": ("PE 1628 W39c",      "QC 175 G939e"),
    "IMG_3350": ("QC 176.8 E4 S993",  "QE 882 P8"),
    "IMG_3351": ("QE 882 R6",         "QH 323.5 Z181b"),
    "IMG_3352": ("QH 323.5 Z181b",    "QH 442.2 G3266"),
    "IMG_3353": ("QH 442.2 G328",     "QH 506 B615"),
    "IMG_3354": ("QH 506 B6153",      "QH 541.5 C7"),
    "IMG_3355": ("QH 541.5 C7",       "QH 581.2 M697"),
    "IMG_3356": ("QH 581.2 M718",     "QH 603 M5 B615"),
    "IMG_3357": ("QH 603 M5 E56",     "QK 177 M682b"),
    "IMG_3358": ("QK 177 M682p",      "QK 495 U48"),
    "IMG_3359": ("QK 495 U48",        "QK 671 M565a"),
    "IMG_3360": ("QK 671 M565a",      "QK 898 B85"),
    "IMG_3361": ("QK 898 B85",        "QL 121 S438"),
    "IMG_3362": ("QL 121 S616c",      "QL 495 C552i"),
    "IMG_3363": ("QL 495 C976",       "QL 639.2 R425"),
    "IMG_3364": ("QL 639.2 T531r",    "QL 687 P3"),
    "IMG_3365": ("QL 687 P3",         "QL 737 C22"),
    "IMG_3366": ("QL 737 C22",        "QL 751 D597s"),
    "IMG_3367": ("QL 751 D7465i",     "QL 963 N289c"),
    "IMG_3368": ("QL 963 N289c",      "QS 4 M334e"),
    "IMG_3369": ("QS 4 M334e",        "QS 675 S645r"),
    "IMG_3370": ("QS 675 S645r",      "QT 140 L665a"),
    "IMG_3371": ("QT 140 L722e",      "QU 25 D628"),
    "IMG_3372": ("QU 25 D6295",       "QU 55 P97"),
    "IMG_3373": ("QU 55 P975",        "QU 83 B615"),
    "IMG_3374": ("QU 83 C331",        "QU 135 C943h"),
    "IMG_3375": ("QU 135 G982e",      "QU 140 J35c"),
    "IMG_3376": ("QU 140 L151",       "QU 325 F791c"),
    "IMG_3377": ("QU 325 G328",       "QV 34 H191"),
    "IMG_3378": ("QV 34 H192",        "QV 39 S126n"),
    "IMG_3379": ("QV 39 S224",        "QV 82 A354"),
    "IMG_3380": ("QV 82 B521",        "QV 247 N117"),
    "IMG_3381": ("QV 247 N814",       "QV 600 B915c"),
    "IMG_3382": ("QV 600 B915c",      "QV 736 S797c"),
    "IMG_3383": ("QV 736 T969",       "QV 766 S971p"),
    "IMG_3384": ("QV 766 T387H",      "QV 772 M537"),
    "IMG_3385": ("QV 772 M721",       "QV 835 U58pe"),
}

order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

for img, (s, e) in data.items():
    assert cmp(s, e) <= 0, f"REVERSED {img}: {s} > {e}"

rows = []
prev_end = None
print(f"{'#':>2}  {'image':10}  {'start':22} - {'end':22}  seam")
for i, (img, (s, e)) in enumerate(order, 1):
    if prev_end is None:
        seam = "(first)"
    else:
        c = cmp(prev_end, s)
        seam = "=EXACT=" if c == 0 else ("gap" if c < 0 else "OVERLAP (row weave)")
    print(f"{i:>2}  {img:10}  {s:22} - {e:22}  {seam}")
    rows.append((i, img, s, e, seam))
    prev_end = e

out = os.path.join(os.path.dirname(__file__), "floor11_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["order","image","start","end","seam_from_prev"])
    w.writerows(rows)
print(f"\nwrote {out} | ordered: {len(rows)} | range: {order[0][1][0]} -> {order[-1][1][1]}")
