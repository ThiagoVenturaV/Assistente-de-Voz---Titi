#!/usr/bin/env python3
"""Apply a shared scale and deterministic vertical arc to extracted jump frames."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames-dir", required=True)
    parser.add_argument("--scale", type=float, default=0.92)
    parser.add_argument("--bottoms", default="203,193,183,193,203")
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir).resolve()
    bottoms = [int(value) for value in args.bottoms.split(",")]
    paths = [frames_dir / f"{index:02d}.png" for index in range(5)]
    if len(bottoms) != len(paths):
        raise SystemExit("--bottoms must contain five comma-separated values")

    results = []
    for index, (path, target_bottom) in enumerate(zip(paths, bottoms)):
        with Image.open(path) as opened:
            frame = opened.convert("RGBA")
        bbox = frame.getchannel("A").getbbox()
        if bbox is None:
            raise SystemExit(f"frame {index} is empty")

        sprite = frame.crop(bbox)
        width = max(1, round(sprite.width * args.scale))
        height = max(1, round(sprite.height * args.scale))
        sprite = sprite.resize((width, height), Image.Resampling.LANCZOS)
        left = (frame.width - width) // 2
        top = target_bottom - height
        if left < 0 or top < 0 or left + width > frame.width or top + height > frame.height:
            raise SystemExit(f"frame {index} would be clipped at {(left, top, left + width, top + height)}")

        output = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        output.alpha_composite(sprite, (left, top))
        output.save(path)
        results.append(
            {
                "frame": index,
                "source_bbox": list(bbox),
                "output_bbox": [left, top, left + width, top + height],
                "target_bottom": target_bottom,
            }
        )

    payload = {
        "ok": True,
        "operation": "shared-scale-deterministic-jump-arc",
        "scale": args.scale,
        "bottoms": bottoms,
        "frames": results,
    }
    output_path = Path(args.json_out).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
