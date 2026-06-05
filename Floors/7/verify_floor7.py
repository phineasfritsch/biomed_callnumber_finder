# VERIFY that floor-7 photos are already in call-number order by filename.
# Reads ranges in filename order and checks the start call numbers are
# monotonically non-decreasing (decimal comparator from Instructions.txt).
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

# Ranges in FILENAME order (IMG number ascending), as read.
rows = [
    ("IMG_3098", "W1 A1C7",   "W1 A1C8"),
    ("IMG_3099", "W1 A1C8",   "W1 A1Q2"),
    ("IMG_3100", "W1 A1Q2",   "W1 AC489"),
    ("IMG_3102", "W1 AC489",  "W1 AC745"),
    ("IMG_3103", "W1 AC7485", "W1 AC809"),
    ("IMG_3104", "W1 AC809",  "W1 AC824"),
    ("IMG_3105", "W1 AC824",  "W1 AC869"),
    ("IMG_3106", "W1 AC869",  "W1 AD153"),
    ("IMG_3107", "W1 AD153",  "W1 AD751"),
    ("IMG_3108", "W1 AD751",  "W1 AD757"),
    ("IMG_3109", "W1 AD757",  "W1 AD844"),
    ("IMG_3110", "W1 AD847",  "W1 AG342"),
    ("IMG_3111", "W1 AG342",  "W1 AL157"),
    ("IMG_3112", "W1 AL157",  "W1 AM169"),
    ("IMG_3113", "W1 AM169",  "W1 AM302"),
    ("IMG_3114", "W1 AM302",  "W1 AM343"),
    ("IMG_3115", "W1 AM343",  "W1 AM4225"),
    ("IMG_3116", "W1 AM4225", "W1 AM4733"),
    ("IMG_3117", "W1 AM4733", "W1 AM477"),
    ("IMG_3118", "W1 AM477",  "W1 AM482"),
    ("IMG_3119", "W1 AM482",  "W1 AM489H"),
    ("IMG_3120", "W1 AM489H", "W1 AM4945"),
    ("IMG_3121", "W1 AM4945", "W1 AM4986"),
    ("IMG_3122", "W1 AM4986", "W1 AM511"),
    ("IMG_3123", "W1 AM511",  "W1 AM511"),
    ("IMG_3124", "W1 AM511",  "W1 AM519"),
    ("IMG_3125", "W1 AM519J", "W1 AM523"),
    ("IMG_3126", "W1 AM523",  "W1 AM538"),
    ("IMG_3127", "W1 AM542",  "W1 AM554"),
    ("IMG_3128", "W1 AM554",  "W1 AM598"),
    ("IMG_3129", "W1 AM598",  "W1 AM6744"),
    ("IMG_3130", "W1 AM6744", "W1 AM972"),
    ("IMG_3131", "W1 AM972",  "W1 AN173"),
    ("IMG_3132", "W1 AN173",  "W1 AN234G"),
    ("IMG_3133", "W1 AN234G", "W1 AN261"),
    ("IMG_3134", "W1 AN261",  "W1 AN602"),
    ("IMG_3135", "W1 AN602",  "W1 AN621"),
    ("IMG_3136", "W1 AN621",  "W1 AN634F"),
    ("IMG_3137", "W1 AN634F", "W1 AN7852"),
    ("IMG_3138", "W1 AN786",  "W1 AN819"),
    ("IMG_3139", "W1 AN819",  "W1 AO671"),
    ("IMG_3140", "W1 AO671",  "W1 AQ141"),
    ("IMG_3141", "W1 AQ141",  "W1 AR405"),
    ("IMG_3142", "W1 AR405",  "W1 AR423H"),
    ("IMG_3143", "W1 AR423H", "W1 AR4471"),
    ("IMG_3144", "W1 AR4471", "W1 AR469"),
    ("IMG_3145", "W1 AR469",  "W1 AR947P"),
    ("IMG_3146", "W1 AR947P", "W1 AT257"),
    ("IMG_3147", "W1 AT257",  "W1 AU759"),
    ("IMG_3148", "W1 AU771",  "W1 AW469"),
]

reversed_ranges = [(img, s, e) for img, s, e in rows if cmp(s, e) > 0]
inversions = []   # later photo whose start sorts BEFORE previous photo's start
overlaps = []     # prev.end > cur.start (backwards seam)
prev = None
for img, s, e in rows:
    if prev:
        pimg, ps, pe = prev
        if cmp(ps, s) > 0:
            inversions.append((pimg, ps, img, s))
        if cmp(pe, s) > 0:
            overlaps.append((pimg, pe, img, s))
    prev = (img, s, e)

print(f"floor 7: {len(rows)} photos, filename order = IMG_3098..IMG_3148 (IMG_3101 missing)")
print(f"reversed single ranges (start>end): {len(reversed_ranges)}")
print(f"out-of-order vs filename (start[i] > start[i+1]): {len(inversions)}")
print(f"backwards seams (prev.end > next.start): {len(overlaps)}")
for a in inversions: print("   INVERSION:", a)
for o in overlaps:   print("   OVERLAP:", o)

# also confirm: sorting by (start,end) reproduces the filename order exactly
ordered = sorted(rows, key=functools.cmp_to_key(
    lambda a, b: cmp(a[1], b[1]) or cmp(a[2], b[2])))
same = [r[0] for r in ordered] == [r[0] for r in rows]
print(f"\nsorted-by-callnumber order == filename order ? {same}")

with open(os.path.join(os.path.dirname(__file__), "floor7_order.csv"), "w", newline="") as f:
    w = csv.writer(f); w.writerow(["order","image","start","end"])
    for i,(img,s,e) in enumerate(rows,1): w.writerow([i,img,s,e])
print("range:", rows[0][1], "->", rows[-1][2])
