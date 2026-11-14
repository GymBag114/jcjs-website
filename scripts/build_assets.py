"""Rebuild runtime WebP layers without modifying source artwork."""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ROOT / "artwork" / "sources"
ASSETS = ROOT / "assets" / "images"
ARTWORK_SIZE = (2560, 1440)
SKY_OVERSCAN = 1.012
SIDE_BLEED = 48
BOTTOM_BLEED = 28


def build_sky():
    # Overscan keeps edges outside the frame during parallax, without mirroring.
    size = tuple(round(value * SKY_OVERSCAN) for value in ARTWORK_SIZE)
    with Image.open(SOURCES / "sky.png") as source:
        source.convert("RGB").resize(size, Image.Resampling.LANCZOS).save(
            ASSETS / "sky.webp", quality=92, method=6
        )
    print("sky", size)


def build_ground():
    # Mirror the sides and bottom beyond the maximum parallax displacement.
    with Image.open(SOURCES / "ground.png") as source:
        plate = source.convert("RGBA")
    width, height = plate.size
    wide = Image.new("RGBA", (width + SIDE_BLEED * 2, height + BOTTOM_BLEED))
    wide.paste(plate, (SIDE_BLEED, 0))
    wide.paste(ImageOps.mirror(plate.crop((0, 0, SIDE_BLEED, height))), (0, 0))
    wide.paste(
        ImageOps.mirror(plate.crop((width - SIDE_BLEED, 0, width, height))),
        (SIDE_BLEED + width, 0),
    )
    for left, right, destination in (
        (0, width, SIDE_BLEED),
        (0, SIDE_BLEED, 0),
        (width - SIDE_BLEED, width, SIDE_BLEED + width),
    ):
        wide.paste(
            ImageOps.flip(plate.crop((left, height - BOTTOM_BLEED, right, height))),
            (destination, height),
        )
    wide.save(ASSETS / "ground.webp", quality=93, method=6)
    print("ground", wide.size, "placed at", (-SIDE_BLEED, 827))


def build_tower():
    # Preserve source alpha, including the translucent right side of the tower.
    with Image.open(ASSETS / "tower.png") as source:
        tower = source.convert("RGBA")
    gray = tower.convert("RGB").convert(
        "L", (0.2126 * 1.22, 0.7152 * 1.22, 0.0722 * 1.22, -255 * 0.11)
    )
    Image.merge("RGBA", (gray, gray, gray, tower.getchannel("A"))).save(
        ASSETS / "tower-monochrome.webp", lossless=True, method=6
    )
    print("tower", tower.size)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    build_sky()
    build_ground()
    build_tower()


if __name__ == "__main__":
    main()
