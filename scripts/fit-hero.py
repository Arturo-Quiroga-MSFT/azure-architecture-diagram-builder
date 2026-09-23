#!/usr/bin/env python3
"""Auto-trim white borders, then fit + pad to 1300x500."""
import sys
from PIL import Image, ImageChops

src, dst = sys.argv[1], sys.argv[2]
TARGET_W, TARGET_H = 1300, 500
SIDE_MARGIN = 90  # extra left/right whitespace so Tech Community doesn't crop edges

im = Image.open(src).convert("RGB")
bg = Image.new("RGB", im.size, (255, 255, 255))
diff = ImageChops.difference(im, bg)
bbox = diff.getbbox()
if bbox:
    im = im.crop(bbox)

# Fit inside target preserving aspect, leaving SIDE_MARGIN of whitespace on each side
w, h = im.size
max_w = TARGET_W - 2 * SIDE_MARGIN
scale = min(max_w / w, TARGET_H / h)
new_w, new_h = int(w * scale), int(h * scale)
im = im.resize((new_w, new_h), Image.LANCZOS)

canvas = Image.new("RGB", (TARGET_W, TARGET_H), (255, 255, 255))
canvas.paste(im, ((TARGET_W - new_w) // 2, (TARGET_H - new_h) // 2))
canvas.save(dst, "PNG", optimize=True)
print(f"{dst}: {TARGET_W}x{TARGET_H} (content {new_w}x{new_h})")
