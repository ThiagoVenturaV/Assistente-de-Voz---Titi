from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "branding" / "titi-head-master.png"
OUTPUT_DIR = ROOT / "build"
LANDING_PUBLIC = ROOT / "landing" / "public"
RENDERER_PUBLIC = ROOT / "mascotes" / "titi" / "package" / "titi"


def resized_icon(source: Image.Image, size: int) -> Image.Image:
    icon = source.copy()
    icon.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((size - icon.width) // 2, (size - icon.height) // 2))
    return canvas


def main() -> None:
    master = Image.open(SOURCE).convert("RGBA")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    LANDING_PUBLIC.mkdir(parents=True, exist_ok=True)
    RENDERER_PUBLIC.mkdir(parents=True, exist_ok=True)

    icon_512 = resized_icon(master, 512)
    icon_512.save(OUTPUT_DIR / "icon.png", optimize=True)
    icon_512.save(
        OUTPUT_DIR / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    icon_512.save(LANDING_PUBLIC / "titi-icon.png", optimize=True)
    icon_512.save(LANDING_PUBLIC / "titi-icon-512.png", optimize=True)
    resized_icon(master, 192).save(LANDING_PUBLIC / "titi-icon-192.png", optimize=True)
    resized_icon(master, 180).save(LANDING_PUBLIC / "apple-touch-icon.png", optimize=True)
    resized_icon(master, 32).save(LANDING_PUBLIC / "favicon-32.png", optimize=True)
    icon_512.save(
        LANDING_PUBLIC / "favicon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48)],
    )

    icon_512.save(RENDERER_PUBLIC / "titi-icon.png", optimize=True)


if __name__ == "__main__":
    main()
