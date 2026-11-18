#!/usr/bin/env python3
"""
Generates every app icon from one vector-ish description, so the artwork can
be tweaked and regenerated rather than living as an opaque binary.

    python3 scripts/make-icons.py

The mark is a stack of chevrons: the lug pattern of a running shoe outsole,
which is what "tread" means, and which also reads as forward motion. Chevrons
survive being shrunk to a home screen tile far better than a silhouette would.
"""

from pathlib import Path
from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "images"

GREEN = (15, 122, 61)
WHITE = (255, 255, 255)

SIZE = 1024
# Three chevrons rather than four, wider and heavier: the group then reads as
# roughly square, which sits better inside a rounded tile than a tall narrow
# stack, and each lug survives being shrunk further.
CHEVRONS = 3
HALF_WIDTH = 250      # horizontal reach of each arm from the centre
ARM_DROP = 165        # how far the arms fall below the apex
SPACING = 175         # apex to apex
STROKE = 82


def draw_mark(canvas_size: int, colour, scale: float = 1.0):
    """The chevron stack on a transparent canvas, centred."""
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    ratio = canvas_size / SIZE * scale
    half = HALF_WIDTH * ratio
    drop = ARM_DROP * ratio
    gap = SPACING * ratio
    stroke = max(2, round(STROKE * ratio))

    group_height = (CHEVRONS - 1) * gap + drop
    centre = canvas_size / 2
    top = (canvas_size - group_height) / 2

    for i in range(CHEVRONS):
        apex_y = top + i * gap
        points = [
            (centre - half, apex_y + drop),
            (centre, apex_y),
            (centre + half, apex_y + drop),
        ]
        draw.line(points, fill=colour, width=stroke, joint="curve")
        # Rounded ends: PIL only rounds the joints, not the extremities.
        for x, y in (points[0], points[2]):
            r = stroke / 2
            draw.ellipse([x - r, y - r, x + r, y + r], fill=colour)

    return image


def flatten(mark: Image.Image, background) -> Image.Image:
    """iOS refuses an alpha channel, so the mark is composited onto a solid."""
    base = Image.new("RGBA", mark.size, background)
    return Image.alpha_composite(base, mark).convert("RGB")


def write(image: Image.Image, name: str) -> None:
    path = ASSETS / name
    image.save(path, "PNG")
    print(f"  {name:34} {image.size[0]}x{image.size[1]}  {image.mode}")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    print("Icônes générées :")

    # Main icon: no alpha, no rounded corners, iOS applies its own mask.
    write(flatten(draw_mark(SIZE, WHITE), GREEN + (255,)), "icon.png")

    # Android adaptive icons crop to roughly the central two thirds, so the
    # foreground mark is scaled down to stay inside that safe zone.
    write(draw_mark(SIZE, WHITE, scale=0.62), "android-icon-foreground.png")
    write(Image.new("RGB", (SIZE, SIZE), GREEN), "android-icon-background.png")
    write(draw_mark(SIZE, WHITE, scale=0.62), "android-icon-monochrome.png")

    # Splash: the mark alone, drawn in green on the app's own canvas colour.
    write(draw_mark(SIZE, GREEN), "splash-icon.png")

    write(flatten(draw_mark(196, WHITE), GREEN + (255,)), "favicon.png")


if __name__ == "__main__":
    main()
