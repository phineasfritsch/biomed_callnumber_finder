# Sort floor-9 (Hist. Div.) photos by call number.
# Mixed LC + NLM scheme: A, CB, Q, QH, QV, W, WC, WM, WX, WZ, ZWZ.
# All labels have "Hist. Div." header. *A = floor-start marker (LC class A).
import re, functools, csv, os

def parse(cn):
    toks = cn.upper().replace('*', '').split()
    if not toks: return [('A',''), ('N',0.0)]
    m0 = re.match(r'^([A-Z]+)(\d*\.?\d*)$', toks[0])
    if not m0: return [('A', toks[0]), ('N', 0.0)]
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

# *A = floor-start marker; the range starts at the very beginning of LC class A.
data = {
    "IMG_3248": ("A",               "CB 53 B262I"),      # *A on label
    "IMG_3249": ("CB 53 B772H",     "Q 41 R81R8"),
    "IMG_3250": ("Q 41 R81S7",      "QH 197 M745F"),
    "IMG_3251": ("QH 204 B726E",    "QV 711 S128"),
    "IMG_3252": ("QV 711 S587M",    "W 19 U645D"),
    "IMG_3253": ("W 19 U645D",      "WC 515 I44I"),
    "IMG_3254": ("WC 160 G7.78T",   "WM 11.1 K189H"),   # row-weave: WC 160 < WC 515
    "IMG_3255": ("WM 11.1 K61J",    "WX 27 GF7 G479H"),
    "IMG_3256": ("WX 27 GF7 P3R5D", "WZ 55 M439Q"),
    "IMG_3257": ("WZ 56 B422S",     "WZ 80.5 A8 A165B"),
    "IMG_3258": ("WZ 80.5 A8 A518M","WZ 100 D259AO"),
    "IMG_3259": ("WZ 100 D259AO",   "WZ 100 H369K"),
    "IMG_3260": ("WZ 100 H369M",    "WZ 100 M549W"),
    "IMG_3261": ("WZ 100 M551S",    "WZ 100 S444A"),
    "IMG_3262": ("WZ 100 S444K",    "WZ 140 AP4 D583P"),
    "IMG_3263": ("WZ 140 AU8 N663G","WZ 292 C744"),
    "IMG_3264": ("WZ 292 C817",     "ZWZ 330"),
}

order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

# sanity: all ranges ascending
for img, (s, e) in data.items():
    assert cmp(s, e) <= 0, f"REVERSED {img}: {s} > {e}"

rows = []
prev_end = None
print(f"{'#':>2}  {'image':10}  {'start':22} - {'end':22}  seam-from-prev")
for i, (img, (s, e)) in enumerate(order, 1):
    if prev_end is None:
        seam = "(first)"
    else:
        c = cmp(prev_end, s)
        seam = "=EXACT=" if c == 0 else ("gap" if c < 0 else "OVERLAP (row weave)")
    print(f"{i:>2}  {img:10}  {s:22} - {e:22}  {seam}")
    rows.append((i, img, s, e, seam))
    prev_end = e

out = os.path.join(os.path.dirname(__file__), "floor9_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["order","image","start","end","seam_from_prev"])
    w.writerows(rows)
print(f"\nwrote {out} | ordered: {len(rows)} | all 17 photos have Hist. Div. header")
print(f"range: {order[0][1][0]} -> {order[-1][1][1]}")
