#!/usr/bin/env python3
"""
WonderQuest — slice-collage.py

Cuts a collage of illustrations into one image per article, upscales if the
source was small, and writes WebP into img/<category>/<article-id>.webp.

The panel edges are found by looking for the white gutters rather than assuming
an even split, because generators rarely place the gaps at exact fractions.

Usage:
    python3 tools/slice-collage.py tools/_raw/batch-01.jpeg --grid 2x2 \\
        --ids octopus-three-hearts saturn-would-float brain-runs-on-electricity wifi-is-radio

Use the literal id "skip" for a panel that failed review:
        --ids skip saturn-would-float ...

Options:
    --grid RxC     grid layout, rows x columns (default 2x2)
    --target N     output width/height in pixels (default 1024)
    --quality N    WebP quality (default 85 — this illustration style needs a
                   higher setting than usual or the paper grain goes blotchy)
    --wire         also write the "image" path into the article JSON, rebuild
                   the index, and report what changed
    --dry-run      report the detected panels without writing anything
"""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
LEDGER = Path(__file__).resolve().parent / "_raw" / ".sliced.json"

WHITE = 236          # a pixel at or above this in every channel counts as gutter
WHITE_RATIO = 0.92   # share of a line that must be white for it to be a gutter
INSET = 0.012        # trim this share of the panel inwards, to drop rounded corners


def perceptual_hash(img):
    """Difference hash: 64 bits describing what the picture looks like, not its bytes."""
    small = img.convert("L").resize((9, 8), Image.LANCZOS)
    px = small.load()
    bits = "".join(
        "1" if px[x, y] > px[x + 1, y] else "0"
        for y in range(8) for x in range(8)
    )
    return f"{int(bits, 2):016x}"


def hamming(a, b):
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def white_lines(img, axis):
    """Return the indexes of rows (axis=0) or columns (axis=1) that are gutter."""
    px = img.convert("RGB").load()
    w, h = img.size
    out = []
    if axis == 0:
        for y in range(h):
            white = sum(1 for x in range(0, w, 3) if min(px[x, y]) >= WHITE)
            if white / len(range(0, w, 3)) >= WHITE_RATIO:
                out.append(y)
    else:
        for x in range(w):
            white = sum(1 for y in range(0, h, 3) if min(px[x, y]) >= WHITE)
            if white / len(range(0, h, 3)) >= WHITE_RATIO:
                out.append(x)
    return out


def runs(indexes):
    """Group consecutive indexes into (start, end) bands."""
    if not indexes:
        return []
    bands, start, prev = [], indexes[0], indexes[0]
    for i in indexes[1:]:
        if i == prev + 1:
            prev = i
            continue
        bands.append((start, prev))
        start = prev = i
    bands.append((start, prev))
    return bands


def cuts(img, axis, count, size):
    """Panel (start, end) ranges along one axis, from the detected gutters."""
    bands = runs(white_lines(img, axis))
    # Drop the outer border bands; what remains between panels are the gutters.
    inner = [b for b in bands if b[0] > size * 0.02 and b[1] < size * 0.98]
    inner.sort(key=lambda b: b[1] - b[0], reverse=True)
    separators = sorted(inner[: count - 1], key=lambda b: b[0])

    if len(separators) != count - 1:
        # Fall back to an even split — reported by the caller so it is visible.
        step = size / count
        return [(round(i * step), round((i + 1) * step)) for i in range(count)], False

    edges, prev = [], 0
    # Start after any outer border
    outer = [b for b in bands if b[0] <= size * 0.02]
    if outer:
        prev = max(b[1] for b in outer) + 1
    for s in separators:
        edges.append((prev, s[0]))
        prev = s[1] + 1
    end = size
    outer_end = [b for b in bands if b[1] >= size * 0.98]
    if outer_end:
        end = min(b[0] for b in outer_end)
    edges.append((prev, end))
    return edges, True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("collage")
    ap.add_argument("--grid", default="2x2")
    ap.add_argument("--ids", nargs="+", required=True)
    ap.add_argument("--target", type=int, default=1024)
    ap.add_argument("--quality", type=int, default=85)
    ap.add_argument("--wire", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="slice an image that has already been used (see the duplicate check)")
    args = ap.parse_args()

    rows, cols = (int(n) for n in args.grid.lower().split("x"))
    if len(args.ids) != rows * cols:
        sys.exit(f"grid {args.grid} needs {rows * cols} ids, got {len(args.ids)}")

    # A collage saved twice under different names silently writes the wrong
    # pictures into the wrong articles, and nothing downstream can detect it —
    # the files are valid, the paths are valid, only the meaning is wrong.
    # A byte hash is not enough: re-downloading the same picture re-encodes it,
    # so the bytes differ while the image is identical. Compare what the image
    # looks like instead.
    #
    # This still cannot catch everything. A collage RE-GENERATED from the same
    # prompt has the same subjects but different pixels, so no image comparison
    # will flag it. That case bit us twice on 2026-09-13. The only real defence
    # is to LOOK AT THE SOURCE IMAGE and check it against the --ids list before
    # running this, and never to test the guard with --wire enabled.
    img = Image.open(args.collage)
    digest = hashlib.sha256(Path(args.collage).read_bytes()).hexdigest()[:16]
    phash = perceptual_hash(img)

    ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() else {}
    if not args.force and not args.dry_run:
        for prev in ledger.values():
            same_bytes = prev.get("sha") == digest
            close = prev.get("phash") and hamming(prev["phash"], phash) <= 6
            if same_bytes or close:
                sys.exit(
                    f"This image looks like one already sliced as {prev['file']}, "
                    f"used for: {', '.join(prev['ids'][:4])}…\n"
                    "The new collage was probably never saved, and slicing it would put the\n"
                    "wrong pictures on the wrong articles.\n"
                    "Check the source image, or pass --force if the reuse is deliberate."
                )

    w, h = img.size
    print(f"{args.collage}  {w}x{h}  grid {rows}x{cols}")

    ybands, y_ok = cuts(img, 0, rows, h)
    xbands, x_ok = cuts(img, 1, cols, w)
    if not (y_ok and x_ok):
        print("  ! gutters not detected cleanly — falling back to an even split")

    # article id -> category, from the live content files
    catalogue = {}
    for cat_file in CONTENT.glob("*.json"):
        if cat_file.name in ("index.json", "categories.json"):
            continue
        try:
            for a in json.loads(cat_file.read_text()):
                catalogue[a["id"]] = cat_file.stem
        except (json.JSONDecodeError, TypeError, KeyError):
            continue

    written = []
    for r in range(rows):
        for c in range(cols):
            article_id = args.ids[r * cols + c]
            if article_id == "skip":
                print(f"  · panel {r},{c}: skipped")
                continue
            if article_id not in catalogue:
                print(f"  ✗ panel {r},{c}: no article with id '{article_id}'")
                continue

            y0, y1 = ybands[r]
            x0, x1 = xbands[c]
            inset_x = int((x1 - x0) * INSET)
            inset_y = int((y1 - y0) * INSET)
            box = (x0 + inset_x, y0 + inset_y, x1 - inset_x, y1 - inset_y)

            panel = img.crop(box)
            side = min(panel.size)                      # force square
            left = (panel.width - side) // 2
            top = (panel.height - side) // 2
            panel = panel.crop((left, top, left + side, top + side))

            note = ""
            if side < args.target:
                panel = panel.resize((args.target, args.target), Image.LANCZOS)
                panel = panel.filter(ImageFilter.UnsharpMask(radius=1.6, percent=55, threshold=3))
                note = f"  (upscaled from {side}px)"

            category = catalogue[article_id]
            out = ROOT / "img" / category / f"{article_id}.webp"
            rel = f"img/{category}/{article_id}.webp"

            if args.dry_run:
                print(f"  · panel {r},{c} → {rel}  source {side}px{note}")
                continue

            out.parent.mkdir(parents=True, exist_ok=True)
            panel.convert("RGB").save(out, "WEBP", quality=args.quality, method=6)
            kb = out.stat().st_size // 1024
            print(f"  ✓ {rel}  {kb} KB{note}")
            written.append((article_id, category, rel))

    if written and not args.dry_run:
        ledger[digest] = {"file": Path(args.collage).name, "sha": digest,
                          "phash": phash, "ids": [w[0] for w in written]}
        LEDGER.write_text(json.dumps(ledger, indent=2) + "\n")

    if args.dry_run or not args.wire:
        if written:
            print('\nSet "image" on each article, or re-run with --wire to do it automatically.')
        return

    for article_id, category, rel in written:
        path = CONTENT / f"{category}.json"
        articles = json.loads(path.read_text())
        for a in articles:
            if a["id"] == article_id:
                a["image"] = rel
        path.write_text(json.dumps(articles, indent=2, ensure_ascii=False) + "\n")

    subprocess.run(["node", str(ROOT / "tools" / "build-index.js")], check=True)
    print(f"\nWired {len(written)} article(s) and rebuilt the index.")


if __name__ == "__main__":
    main()
