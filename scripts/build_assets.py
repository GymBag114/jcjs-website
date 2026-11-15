"""Rebuild the monochrome tower from the lossless runtime WebP."""
from pathlib import Path

from PIL import Image

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "images"


def build_tower():
    # Preserve source alpha, including the translucent right side of the tower.
    with Image.open(ASSETS / "tower.webp") as source:
        tower = source.convert("RGBA")
    gray = tower.convert("RGB").convert(
        "L", (0.2126 * 1.22, 0.7152 * 1.22, 0.0722 * 1.22, -255 * 0.11)
    )
    Image.merge("RGBA", (gray, gray, gray, tower.getchannel("A"))).save(
        ASSETS / "tower-monochrome.webp", lossless=True, method=6
    )
    print("tower", tower.size)



if __name__ == "__main__":
    build_tower()
