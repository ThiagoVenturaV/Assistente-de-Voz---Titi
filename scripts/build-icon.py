from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "mascotes" / "titi" / "qa" / "rows" / "idle" / "frames" / "idle" / "00.png"
OUTPUT_DIR = ROOT / "build"


def main() -> None:
    mascot = Image.open(SOURCE).convert("RGBA")
    mascot.thumbnail((210, 220), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    x = (canvas.width - mascot.width) // 2
    y = (canvas.height - mascot.height) // 2
    canvas.alpha_composite(mascot, (x, y))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    canvas.save(OUTPUT_DIR / "icon.png", optimize=True)
    canvas.save(
        OUTPUT_DIR / "icon.ico",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


if __name__ == "__main__":
    main()
