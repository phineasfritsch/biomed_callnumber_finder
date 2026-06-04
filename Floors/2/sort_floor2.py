# Order floor-2 shelf-end photos by library call number (W1 scheme).
# Decimal comparator from Instructions.txt (digits after a letter group are a
# DECIMAL fraction, so NA1991 = .1991 < NA835 = .835).
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

data = {
    "IMG_3013": ("W1 MO283",  "W1 MO287"),
    "IMG_3014": ("W1 ME967",  "W1 MI186KH"),
    "IMG_3015": ("W1 MD239",  "W1 ME2379"),
    "IMG_3016": ("W1 MI625",  "W1 MO283"),
    "IMG_3017": ("W1 ME635P", "W1 ME967"),
    "IMG_3018": ("W1 MA757R", "W1 MC637"),
    "IMG_3019": ("W1 MA166",  "W1 MA757R"),
    "IMG_3020": ("W1 ME2379", "W1 ME338"),
    "IMG_3021": ("W1 ME338",  "W1 ME635P"),
    "IMG_3022": ("W1 MI186KH","W1 MI425"),
    "IMG_3023": ("W1 MI425",  "W1 MI625"),
    "IMG_3024": ("W1 MO287",  "W1 MO295M"),
    "IMG_3025": ("W1 MO296A", "W1 MO583"),
    "IMG_3026": ("W1 MO594",  "W1 MU869"),
    "IMG_3027": ("W1 MU869",  "W1 NA1991"),
    "IMG_3028": ("W1 NA1991", "W1 NA835"),
    "IMG_3029": ("W1 NA835",  "W1 NA835"),
    "IMG_3030": ("W1 NA839",  "W1 NE185"),
    "IMG_3031": ("W1 NE185",  "W1 NE252N"),
    "IMG_3032": ("W1 NE252N", "W1 NE282"),
    "IMG_3033": ("W1 NE282",  "W1 NE286DB"),
    "IMG_3034": ("W1 NE286DH","W1 NE286GK"),
    "IMG_3035": ("W1 NE286GK","W1 NE411"),
    "IMG_3036": ("W1 NE411",  "W1 NE411"),
    "IMG_3037": ("W1 NE419",  "W1 NE554"),
    "IMG_3038": ("W1 NE793",  "W1 NI885"),
    "IMG_3039": ("W1 NI885",  "W1 NO122D"),
    "IMG_3040": ("W1 NU511",  "W1 NU701"),
    "IMG_3041": ("W1 NU701",  "W1 NU866"),
    "IMG_3042": ("W1 OK716",  "W1 OP264"),
    "IMG_3043": ("W1 OP264",  "W1 OR129"),
    "IMG_3044": ("W1 OR129",  "W1 OR854"),
    "IMG_3045": ("W1 OR854",  "W1 PA180"),
    "IMG_3046": ("W1 PA971",  "W1 PE135H"),
    "IMG_3047": ("W1 PE135H", "W1 PE729"),
    "IMG_3048": ("W1 PH663",  "W1 PH925"),
    "IMG_3049": ("W1 PH925",  "W1 PL111"),
    "IMG_3050": ("W1 PO971",  "W1 PO971"),
    "IMG_3051": ("W1 PL217",  "W1 PO971"),
    "IMG_3052": ("W1 PL111Y", "W1 PL217"),
    "IMG_3053": ("W1 PH294",  "W1 PH663"),
    "IMG_3054": ("W1 PE734",  "W1 PH294"),
    "IMG_3055": ("W1 PA227",  "W1 PA971"),
    "IMG_3056": ("W1 OC217",  "W1 OK716"),
    "IMG_3057": ("W1 NU869",  "W1 OC217"),
    "IMG_3058": ("W1 NO923",  "W1 NU511"),
    "IMG_3059": ("W1 NO129",  "W1 NO923"),
    "IMG_3060": ("W1 NE554",  "W1 NE788"),
    "IMG_3061": ("W1 NE554",  "W1 NE554"),
}

order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

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

out = os.path.join(os.path.dirname(__file__), "floor2_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["order", "image", "start", "end", "seam_from_prev"])
    w.writerows(rows)
print("\nwrote", out, "| ordered:", len(rows), "| blanks: none")
