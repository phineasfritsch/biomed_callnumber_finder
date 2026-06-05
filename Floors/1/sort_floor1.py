# Order floor-1 shelf-end photos by library call number.
# Floor 1 spans classes W1, W2, W3, W4C. The class token can carry a trailing
# letter (e.g. "W4C"), so the class regex is extended with an optional trailing
# letter group vs. the W1-only floors. For all W1 entries this is empty, so the
# ordering is identical to the comparator used on floors 2/3/5/7.
import re, functools, csv, os

def parse(cn):
    toks = cn.upper().replace('*', '').split()
    m0 = re.match(r'^([A-Z]+)(\d*\.?\d*)([A-Z]*)$', toks[0])   # +trailing letters
    class_alpha = m0.group(1)
    class_sfx = m0.group(3)
    rest = toks[1:]
    if m0.group(2):
        class_num = float(m0.group(2))
    elif rest and re.match(r'^\d+\.?\d*$', rest[0]):
        class_num = float(rest[0]); rest = rest[1:]
    else:
        class_num = 0.0
    comp = [('A', class_alpha), ('N', class_num), ('S', class_sfx)]
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

# image -> (start, end). IMG_3151 omitted (exact duplicate of IMG_3150).
data = {
    "IMG_3149": ("W1 PR189",   "W1 PR5606"),
    "IMG_3150": ("W1 PR611P",  "W1 PR7498"),
    "IMG_3153": ("W1 PR823U",  "W1 PS377"),
    "IMG_3154": ("W1 PS388",   "W1 PS607"),
    "IMG_3155": ("W1 PS607",   "W1 PS721M"),
    "IMG_3156": ("W1 PS724",   "W1 PS827"),
    "IMG_3157": ("W1 PS836",   "W1 QU570"),
    "IMG_3158": ("W1 QU570",   "W1 RA349"),
    "IMG_3159": ("W1 RA369",   "W1 RE160"),
    "IMG_3160": ("W1 RE160",   "W1 RE230TM"),
    "IMG_3161": ("W1 RE230TM", "W1 RE563"),
    "IMG_3162": ("W1 RE563",   "W1 RI309"),
    "IMG_3163": ("W1 RI309",   "W1 RO835"),
    "IMG_3164": ("W1 RO835",   "W1 SC148"),
    "IMG_3165": ("W1 SC148",   "W1 SC308"),
    "IMG_3166": ("W1 SC308A",  "W1 SC831"),
    "IMG_3167": ("W1 SC831",   "W1 SE607K"),
    "IMG_3168": ("W1 SE607K",  "W1 SK371"),
    "IMG_3169": ("W1 SL217",   "W1 SO134"),
    "IMG_3170": ("W1 SO134",   "W1 SO8744"),
    "IMG_3171": ("W1 SO8744",  "W1 SO9885"),
    "IMG_3172": ("W1 SO9911",  "W1 ST469"),
    "IMG_3173": ("W1 ST897",   "W1 SU823"),
    "IMG_3174": ("W1 SU823",   "W1 SU861"),
    "IMG_3175": ("W1 SU861",   "W1 TE821"),
    "IMG_3176": ("W1 TE821",   "W1 TI935"),
    "IMG_3177": ("W1 TO13",    "W1 TO977"),
    "IMG_3178": ("W1 TO977",   "W1 TR323"),
    "IMG_3179": ("W1 TR336A",  "W1 TU671"),
    "IMG_3180": ("W1 TU671",   "W1 UR716"),
    "IMG_3181": ("W1 UR716",   "W1 VE936"),
    "IMG_3182": ("W1 VE936",   "W1 VI801"),
    "IMG_3183": ("W1 VI801",   "W1 VO917"),
    "IMG_3184": ("W1 VO917",   "W1 WI741"),
    "IMG_3185": ("W1 WI871",   "W1 YE197"),
    "IMG_3186": ("W1 YE205",   "W1 YE767"),
    "IMG_3187": ("W1 YE823",   "W1 ZH765"),
    "IMG_3188": ("W1 ZH765",   "W2 AN231AN"),
    "IMG_3189": ("W2 AN231AN", "W2 AW4 P6P"),
    "IMG_3190": ("W2 AW4 D6P", "W3 AD215"),
    "IMG_3191": ("W3 AD215",   "W3 EU915"),
    "IMG_3192": ("W3 EU915",   "W3 IN8715H"),
    "IMG_3193": ("W3 IN8715M", "W3 NA794"),
    "IMG_3194": ("W3 NE161",   "W3 WO542"),
    "IMG_3195": ("W3 WO542",   "W4C K764I"),
    "IMG_3196": ("W4C K79M",   "W4C W382I"),
    "IMG_3197": ("W4C W397A",  "W4C Z89P 2009"),
}

order = sorted(data.items(), key=functools.cmp_to_key(
    lambda a, b: cmp(a[1][0], b[1][0]) or cmp(a[1][1], b[1][1])))

for img, (s, e) in data.items():
    assert cmp(s, e) <= 0, f"REVERSED {img}: {s} > {e}"

rows = []
prev_end = None
print(f"{'#':>2}  {'image':10}  {'start':12} - {'end':14}  seam-from-prev")
for i, (img, (s, e)) in enumerate(order, 1):
    if prev_end is None:
        seam = "(first)"
    else:
        c = cmp(prev_end, s)
        seam = "=EXACT=" if c == 0 else ("gap" if c < 0 else "OVERLAP (row weave)")
    print(f"{i:>2}  {img:10}  {s:12} - {e:14}  {seam}")
    rows.append((i, img, s, e, seam))
    prev_end = e

out = os.path.join(os.path.dirname(__file__), "floor1_order.csv")
with open(out, "w", newline="") as f:
    w = csv.writer(f); w.writerow(["order", "image", "start", "end", "seam_from_prev"])
    w.writerows(rows)
# tidy temp full-res files
for n in (3188, 3189, 3190):
    p = os.path.join(os.path.dirname(__file__), "jpg", f"fullres_IMG_{n}.jpg")
    if os.path.exists(p): os.remove(p)
print("\nwrote", out, "| ordered:", len(rows), "| duplicate set aside: IMG_3151 (=IMG_3150)")
print("range:", order[0][1][0], "->", order[-1][1][1])
