#!/usr/bin/env python3
"""Generate AutoTube PNG app icons from the shared design tokens."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIRS = [
    ROOT / "frontend" / "public",
    ROOT / "docs" / "public-site",
]

# globals.css design tokens
BG_TOP = (26, 32, 48)       # #1a2030
BG_BOTTOM = (11, 13, 18)    # #0b0d12
SCREEN_TOP = (20, 24, 36)   # #141824
SCREEN_BOTTOM = (15, 18, 32)  # #0f1220
ACCENT_START = (129, 140, 248)  # #818cf8
ACCENT_END = (99, 102, 241)     # #6366f1
WHITE = (255, 255, 255)
DOT = (129, 140, 248)


def lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def lerp_color(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)


def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(size - 1, 1)
        color = lerp_color(top, bottom, t)
        for x in range(size):
            px[x, y] = color
    return img


def rounded_mask(size: int, radius: float) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def draw_icon(size: int) -> Image.Image:
    scale = size / 32.0
    base = vertical_gradient(size, BG_TOP, BG_BOTTOM).convert("RGBA")
    mask = rounded_mask(size, 8 * scale)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(base, mask=mask)
    draw = ImageDraw.Draw(canvas)

    tube = (
        6.25 * scale,
        7.25 * scale,
        6.25 * scale + 19.5 * scale,
        7.25 * scale + 17.5 * scale,
    )
    screen = (
        8 * scale,
        9 * scale,
        8 * scale + 16 * scale,
        9 * scale + 14 * scale,
    )

    # Accent stroke via layered rounded rects (gradient approximation)
    stroke = max(1, int(round(1.5 * scale)))
    for i in range(stroke):
        t = i / max(stroke - 1, 1)
        color = lerp_color(ACCENT_START, ACCENT_END, t) + (255,)
        inset = i * 0.45
        draw.rounded_rectangle(
            (tube[0] + inset, tube[1] + inset, tube[2] - inset, tube[3] - inset),
            radius=4.25 * scale,
            outline=color,
            width=1,
        )

    screen_img = vertical_gradient(int(screen[3] - screen[1]) or 1, SCREEN_TOP, SCREEN_BOTTOM)
    screen_mask = Image.new("L", screen_img.size, 0)
    ImageDraw.Draw(screen_mask).rounded_rectangle(
        (0, 0, screen_img.width - 1, screen_img.height - 1),
        radius=2.75 * scale,
        fill=255,
    )
    screen_rgba = screen_img.convert("RGBA")
    screen_rgba.putalpha(screen_mask)
    canvas.alpha_composite(
        screen_rgba,
        dest=(int(round(screen[0])), int(round(screen[1]))),
    )

    # Play triangle
    cx, cy = 17.125 * scale, 16 * scale
    h = 6.5 * scale
    w = 5.75 * scale
    left = cx - w / 2
    play = [
        (left, cy - h / 2),
        (left, cy + h / 2),
        (left + w, cy),
    ]
    draw.polygon(play, fill=WHITE + (255,))

    # Automation accent dot
    dot_r = 1.35 * scale
    dot_x, dot_y = 24.5 * scale, 8.5 * scale
    draw.ellipse(
        (dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r),
        fill=DOT + (230,),
    )

    return canvas


def main() -> None:
    outputs = {
        "icon-192.png": 192,
        "icon-512.png": 512,
        "icon-1024.png": 1024,
        "apple-touch-icon.png": 180,
    }

    for directory in OUTPUT_DIRS:
        directory.mkdir(parents=True, exist_ok=True)
        for filename, size in outputs.items():
            path = directory / filename
            draw_icon(size).save(path, format="PNG", optimize=True)
            print(f"Wrote {path}")


if __name__ == "__main__":
    main()
