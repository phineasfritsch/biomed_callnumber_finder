#!/usr/bin/env python3
"""Build the app's bundled fonts from the upstream variable sources.

    pip install fonttools brotli
    python ios/Tools/make-fonts.py

Why statics rather than shipping the variable TTFs directly:

* Fraunces' variable default instance is **Black at 9pt optical size**. Shelfmark sets weight 600
  and lets the browser pick the optical size from the font size. A UIFont that resolves to the
  family default would therefore render every heading in the app as heavy 9pt-optical Fraunces —
  visibly not the website. Named instances of a variable font are *usually* reachable on iOS by
  PostScript name, but "usually" is not something worth betting a whole visual system on when the
  build loop is ten minutes long and nothing here can be compiled locally.
* Static instances have exactly one interpretation. `UIFont(name: "Fraunces-SemiBold", size:)`
  either finds that file or it does not.

Optical size is pinned at 20, which is where the display face is actually used (26 / 22 / 17pt
titles). Fraunces at opsz 9 is a caption face and at 144 a poster face; neither is this app.

Subset to the Latin the UI can produce, plus the punctuation the copy uses (·, ×, —, ellipsis).
Full-charset statics are ~250 KB each and there are six of them; subset they are a fraction of it.

Neither family contains U+2192 (→). That is why shelf ranges are written with an en dash rather
than an arrow: an arrow would silently fall back to the system face mid-line, which reads as a
rendering bug rather than as a choice.
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "BiomedShelfScanner" / "Resources" / "Fonts"

# Everything the UI can actually render: Latin-1, the quotes and dashes the copy uses, the
# middot that separates a location ("L2 · top-5 · right"), and the times sign in a quantity
# badge. Directional cues are SF Symbols, not text, so no arrows are needed — which is just as
# well, since neither family has any.
UNICODES = ",".join([
    "U+0020-007E", "U+00A0-00FF",
    "U+0131", "U+0152-0153",
    "U+2013-2014", "U+2018-2019", "U+201C-201D", "U+2022", "U+2026",
    "U+00B7", "U+00D7", "U+2212", "U+20AC",
])

BUILDS = [
    # (source, output stem, axis settings)
    ("Fraunces-Variable.ttf", "Fraunces-Regular",  {"wght": 400, "opsz": 20}),
    ("Fraunces-Variable.ttf", "Fraunces-Medium",   {"wght": 500, "opsz": 20}),
    ("Fraunces-Variable.ttf", "Fraunces-SemiBold", {"wght": 600, "opsz": 20}),
    ("SplineSansMono-Variable.ttf", "SplineSansMono-Regular",  {"wght": 400}),
    ("SplineSansMono-Variable.ttf", "SplineSansMono-Medium",   {"wght": 500}),
    ("SplineSansMono-Variable.ttf", "SplineSansMono-SemiBold", {"wght": 600}),
]


def run(*args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"failed: {' '.join(args)}\n{r.stdout}\n{r.stderr}")


def main():
    from fontTools.ttLib import TTFont

    for src, stem, axes in BUILDS:
        source = ROOT / src
        if not source.exists():
            sys.exit(f"missing source: {source}\nDownload the upstream variable fonts first.")
        out = ROOT / f"{stem}.ttf"

        run(sys.executable, "-m", "fontTools.varLib.instancer",
            str(source), *[f"{k}={v}" for k, v in axes.items()],
            "-o", str(out))
        run(sys.executable, "-m", "fontTools.subset", str(out),
            f"--unicodes={UNICODES}",
            "--layout-features=kern,liga,calt,tnum,onum,frac",
            "--name-IDs=*", "--recalc-bounds", f"--output-file={out}")

        # The instancer keeps the *source* family's naming, so every instance would claim to be
        # the same font and the second one registered would lose. Name each file for what it is.
        f = TTFont(out)
        family = "Fraunces" if stem.startswith("Fraunces") else "Spline Sans Mono"
        sub = stem.split("-", 1)[1]
        full = f"{family} {sub}" if sub != "Regular" else family
        for rec in f["name"].names:
            nid = rec.nameID
            if nid == 1:
                rec.string = family
            elif nid == 2:
                rec.string = sub
            elif nid == 4:
                rec.string = full
            elif nid == 6:
                rec.string = stem
            elif nid in (16, 17):
                rec.string = family if nid == 16 else sub
        f.save(out)
        print(f"{out.name:32} {out.stat().st_size / 1024:6.1f} KB   {axes}")


if __name__ == "__main__":
    main()
