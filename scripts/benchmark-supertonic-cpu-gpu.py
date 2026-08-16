#!/usr/bin/env python3

import argparse
import hashlib
import json
import math
import os
import statistics
import subprocess
import sys
import time
import wave
from array import array
from pathlib import Path

import sherpa_onnx


DLL_DIRECTORY_HANDLES = []


TEXTS = {
    "short": "Pronto, Tiago. O Spotify foi aberto e a música começou a tocar.",
    "medium": (
        "Claro, Tiago. Encontrei o controle do Spotify, iniciei a reprodução e mantive "
        "a conversa ativa. Se quiser, posso pausar, trocar de faixa ou ajustar o volume."
    ),
    "long": (
        "Entendido, Tiago. O Titi analisou o pedido em linguagem natural, verificou os "
        "controles visíveis e executou somente a ação solicitada. A conversa continua "
        "totalmente local, sem enviar sua voz para a nuvem. Se você mudar de ideia, basta "
        "pedir para pausar a música, abrir outro aplicativo ou encerrar a conversa ao vivo."
    ),
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--provider", choices=("cpu", "cuda"), required=True)
    parser.add_argument("--model-root", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--repetitions", type=int, default=5)
    parser.add_argument("--threads", type=int, default=4)
    return parser.parse_args()


def add_cuda_dll_directories():
    if os.name != "nt":
        return []
    nvidia_root = Path(sys.prefix) / "Lib" / "site-packages" / "nvidia"
    directories = sorted(nvidia_root.glob("*/bin"))
    available = [directory for directory in directories if directory.is_dir()]
    for directory in available:
        DLL_DIRECTORY_HANDLES.append(os.add_dll_directory(str(directory)))
    if available:
        os.environ["PATH"] = os.pathsep.join(map(str, available)) + os.pathsep + os.environ["PATH"]
    return [str(directory) for directory in available]


def create_engine(args):
    root = args.model_root.resolve()
    supertonic = sherpa_onnx.OfflineTtsSupertonicModelConfig(
        duration_predictor=str(root / "duration_predictor.int8.onnx"),
        text_encoder=str(root / "text_encoder.int8.onnx"),
        vector_estimator=str(root / "vector_estimator.int8.onnx"),
        vocoder=str(root / "vocoder.int8.onnx"),
        tts_json=str(root / "tts.json"),
        unicode_indexer=str(root / "unicode_indexer.bin"),
        voice_style=str(root / "voice.bin"),
    )
    model = sherpa_onnx.OfflineTtsModelConfig(
        supertonic=supertonic,
        num_threads=args.threads,
        debug=False,
        provider=args.provider,
    )
    return sherpa_onnx.OfflineTts(
        sherpa_onnx.OfflineTtsConfig(model=model, max_num_sentences=2)
    )


def generation_config():
    config = sherpa_onnx.GenerationConfig()
    config.sid = 5
    config.speed = 1.02
    config.num_steps = 5
    config.extra = {"lang": "pt"}
    return config


def sample_bytes(samples):
    if hasattr(samples, "astype"):
        return samples.astype("float32", copy=False).tobytes()
    return array("f", samples).tobytes()


def audio_stats(audio):
    values = audio.samples
    count = len(values)
    squared = sum(float(value) * float(value) for value in values)
    peak = max(abs(float(value)) for value in values)
    return {
        "sample_rate": int(audio.sample_rate),
        "sample_count": count,
        "audio_ms": round(count / audio.sample_rate * 1000),
        "rms": math.sqrt(squared / count),
        "peak": peak,
        "float32_sha256": hashlib.sha256(sample_bytes(values)).hexdigest(),
    }


def write_pcm16(path, audio):
    pcm = array(
        "h",
        (
            max(-32768, min(32767, round(float(value) * 32767)))
            for value in audio.samples
        ),
    )
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(int(audio.sample_rate))
        output.writeframes(pcm.tobytes())


def gpu_snapshot():
    command = [
        "nvidia-smi",
        "--query-compute-apps=pid,used_memory",
        "--format=csv,noheader,nounits",
    ]
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError):
        return None
    current_pid = str(__import__("os").getpid())
    for line in result.stdout.splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) == 2 and parts[0] == current_pid:
            try:
                return int(parts[1])
            except ValueError:
                return None
    return 0


def percentile(values, fraction):
    ordered = sorted(values)
    index = min(len(ordered) - 1, math.ceil(len(ordered) * fraction) - 1)
    return ordered[index]


def main():
    args = parse_args()
    if args.repetitions < 2:
        raise ValueError("Use ao menos duas repetições.")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    cuda_dll_directories = add_cuda_dll_directories()

    started = time.perf_counter()
    engine = create_engine(args)
    init_ms = (time.perf_counter() - started) * 1000
    gpu_after_init_mib = gpu_snapshot()

    engine.generate(TEXTS["short"], generation_config())
    gpu_after_warmup_mib = gpu_snapshot()

    cases = {}
    for label, text in TEXTS.items():
        timings = []
        representative = None
        for _ in range(args.repetitions):
            started = time.perf_counter()
            audio = engine.generate(text, generation_config())
            timings.append((time.perf_counter() - started) * 1000)
            representative = audio
        assert representative is not None
        stats = audio_stats(representative)
        write_pcm16(args.output_dir / f"supertonic-{args.provider}-{label}.wav", representative)
        cases[label] = {
            "characters": len(text),
            "median_ms": round(statistics.median(timings), 2),
            "min_ms": round(min(timings), 2),
            "p95_ms": round(percentile(timings, 0.95), 2),
            "realtime_factor": round(statistics.median(timings) / stats["audio_ms"], 4),
            "runs_ms": [round(value, 2) for value in timings],
            **stats,
        }

    result = {
        "provider": args.provider,
        "sherpa_version": getattr(sherpa_onnx, "__version__", "unknown"),
        "threads": args.threads,
        "cuda_dll_directories": cuda_dll_directories,
        "repetitions": args.repetitions,
        "engine_init_ms": round(init_ms, 2),
        "gpu_process_memory_after_init_mib": gpu_after_init_mib,
        "gpu_process_memory_after_warmup_mib": gpu_after_warmup_mib,
        "cases": cases,
    }
    output = args.output_dir / f"supertonic-{args.provider}.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
