#!/usr/bin/env python3
"""Derive the complete left-running row from approved right-running cells."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--right-dir", required=True)
    parser.add_argument("--left-dir", required=True)
    parser.add_argument("--json-out", required=True)
    args = parser.parse_args()

    right_dir = Path(args.right_dir).resolve()
    left_dir = Path(args.left_dir).resolve()
    left_dir.mkdir(parents=True, exist_ok=True)
    outputs = []

    for index in range(8):
        source = right_dir / f"{index:02d}.png"
        target = left_dir / f"{index:02d}.png"
        with Image.open(source) as opened:
            frame = opened.convert("RGBA")
        mirrored = frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        mirrored.save(target)
        outputs.append({"frame": index, "source": str(source), "output": str(target)})

    payload = {
        "ok": True,
        "operation": "framewise-horizontal-mirror-preserving-order",
        "frames": outputs,
    }
    manifest = Path(args.json_out).resolve()
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
