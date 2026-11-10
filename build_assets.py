"""Build the parallax layers; source PNGs are never modified.

Layer order, verified against 完整画面.png (the reference composite):

    sky    (背景.png  - the full plate: clouds, geometric shapes, floating slabs)
    emblem (JCJS_LOGO.svg)
    tower  (塔.png)
    stones (石头.png - the big slabs again, so they stay in front of the mark)
    ground (地面.png - the plaza, in front of everything)

The new 背景.png is a complete, fully opaque plate, so nothing can ever be
uncovered. It is still painted with the big slabs, hence the stones plane has
to travel at exactly the same depth as the sky: same transform, no double
image, and the mark still passes behind them.
"""
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
W, H = 2560, 1440

# The sky slides at depth 0.15, i.e. at most 4.8 / 2.7px. Overscanning it by
# 1.2% keeps its edges outside the frame without mirroring (which would put a
# reflection seam where the artwork gets cut), and keeps the artwork itself
# within ~12px of the reference geometry.
SKY_OVER = 1.012
SKY_W, SKY_H = round(W * SKY_OVER), round(H * SKY_OVER)

# The ground is the nearest plane and slides up to 40 / 22px, so its mirrored
# overscan has to be wider than that on every side that can be uncovered.
GROUND_TOP = 827
SIDE_BLEED = 48
BOTTOM_BLEED = 28

# --- sky: the whole plate, overscanned so its edges never enter the frame.
Image.open(ROOT / "背景.png").convert("RGB").resize((SKY_W, SKY_H), Image.LANCZOS).save(
    ASSETS / "sky.webp", quality=92, method=6
)

# --- ground: mirrored overscan left, right and below.
plate = Image.open(ROOT / "地面.png").convert("RGBA")
wide = Image.new("RGBA", (plate.width + SIDE_BLEED * 2, plate.height + BOTTOM_BLEED))
wide.paste(plate, (SIDE_BLEED, 0))
wide.paste(ImageOps.mirror(plate.crop((0, 0, SIDE_BLEED, plate.height))), (0, 0))
wide.paste(ImageOps.mirror(plate.crop((plate.width - SIDE_BLEED, 0, plate.width, plate.height))), (SIDE_BLEED + plate.width, 0))
wide.paste(ImageOps.flip(plate.crop((0, plate.height - BOTTOM_BLEED, plate.width, plate.height))), (SIDE_BLEED, plate.height))
wide.paste(ImageOps.flip(plate.crop((0, plate.height - BOTTOM_BLEED, SIDE_BLEED, plate.height))), (0, plate.height))
wide.paste(ImageOps.flip(plate.crop((plate.width - SIDE_BLEED, plate.height - BOTTOM_BLEED, plate.width, plate.height))), (SIDE_BLEED + plate.width, plate.height))
wide.save(ASSETS / "ground.webp", quality=93, method=6)

print("sky", (SKY_W, SKY_H))
print("ground", wide.size, "placed at", (-SIDE_BLEED, GROUND_TOP))
