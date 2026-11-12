"""Model metadata and cached, model-free accelerator probes for local providers."""
from __future__ import annotations

import importlib.metadata
import importlib.util
import shutil
from copy import deepcopy
from importlib.machinery import PathFinder
from pathlib import Path
from typing import Any

from ..config import ffmpeg_binary, ffprobe_binary
from ..accelerators import detect_devices
from ..resources import missing_modules, version_supported, version_requirement
from .segments import LANGUAGES


def _detect_devices() -> list[dict[str, Any]]:
    return deepcopy(detect_devices())


def _model(
    model_id: str, devices: list[str], source_languages: list[str], target_languages: list[str],
) -> dict[str, Any]:
    return {
        "id": model_id, "devices": devices, "source_languages": source_languages,
        "target_languages": target_languages, "voice_modes": [], "voices": [],
    }


def _whisper_models(devices: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    if importlib.util.find_spec("whisper") is None or importlib.util.find_spec("torch") is None:
        return [], "Whisper cục bộ cần cài openai-whisper và torch."
    if shutil.which(ffmpeg_binary()) is None or shutil.which(ffprobe_binary()) is None:
        return [], "Xử lý phương tiện cục bộ cần FFmpeg và FFprobe có thể thực thi."
    # Whisper's own load_audio invokes `ffmpeg` by name, independently of the
    # application's configured binary paths used by prepare/export.
    if shutil.which("ffmpeg") is None:
        return [], "Whisper ASR còn cần ffmpeg có thể thực thi trong PATH; chỉ cấu hình FFMPEG_PATH là không đủ để đọc âm thanh."
    from .asr import available_models

    # OpenAI Whisper stores sparse alignment heads; MPS cannot move these
    # buffers. Keep its ASR on CPU while other providers can use Apple MPS.
    available_devices = [device["id"] for device in devices if device["available"] and device["id"] != "mps"]
    if not available_devices:
        return [], "Không có thiết bị CPU/CUDA/ROCm nào có thể chạy Whisper."
    models = [_model(
        name, available_devices.copy(), ["auto", "en"] if name.endswith(".en") else ["auto", *LANGUAGES], [],
    ) for name in available_models()]
    return models, None if models else "Không tìm thấy trọng số Whisper .pt cục bộ không rỗng; hãy cài vào thư mục mô hình Whisper."


def _voxcpm_models(devices: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    missing = missing_modules(["base", "media", "voxcpm"])
    if missing:
        return [], f"VoxCPM2 cục bộ thiếu phụ thuộc chạy: {', '.join(missing)}."
    # Check installed distribution metadata, never import VoxCPM during a GET.
    if not version_supported("voxcpm"):
        return [], f"VoxCPM2 cục bộ cần voxcpm{version_requirement('voxcpm')}, để hỗ trợ lựa chọn thiết bị CPU/CUDA/ROCm/MPS rõ ràng."
    if shutil.which(ffmpeg_binary()) is None or shutil.which(ffprobe_binary()) is None:
        return [], "Xử lý phương tiện cục bộ cần FFmpeg và FFprobe có thể thực thi."
    from .tts import available_models

    available_devices = [device["id"] for device in devices if device["available"]]
    if not available_devices:
        return [], "Không có thiết bị CPU/CUDA/ROCm/MPS nào có thể chạy VoxCPM2."
    models = [_model(name, available_devices.copy(), list(LANGUAGES), list(LANGUAGES))
              for name in available_models()]
    for model in models:
        model["voice_modes"] = ["source_clone"]
    return models, None if models else "Trọng số hoặc tài nguyên tokenizer của VoxCPM2 cục bộ không đầy đủ."


def _demucs_models(devices: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    # The child selects this vendored module path, independently of site-packages.
    source = Path(__file__).resolve().parents[3] / "submodule" / "demucs"
    if PathFinder.find_spec("demucs", [str(source)]) is None:
        return [], "Thiếu mã nguồn module con Demucs trong kho."
    missing = missing_modules(["media", "demucs"])
    if missing:
        return [], f"Demucs cục bộ thiếu phụ thuộc chạy: {', '.join(missing)}."
    if shutil.which(ffmpeg_binary()) is None or shutil.which(ffprobe_binary()) is None:
        return [], "Xử lý phương tiện cục bộ cần FFmpeg và FFprobe có thể thực thi."
    from .separate import available_models

    available_devices = [device["id"] for device in devices if device["available"]]
    if not available_devices:
        return [], "Không có thiết bị CPU/CUDA/ROCm/MPS nào có thể chạy Demucs."
    models = [_model(name, available_devices.copy(), [], [])
              for name in available_models()]
    return models, None if models else "Không tìm thấy trọng số htdemucs cục bộ không rỗng."


def _subtitle_alignment_models(devices: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
    missing = missing_modules(["base", "media", "qwen_forced_aligner"])
    if missing:
        return [], f"Căn chỉnh phụ đề Qwen cục bộ thiếu phụ thuộc chạy: {', '.join(missing)}."
    if not version_supported("transformers"):
        return [], f"Căn chỉnh phụ đề Qwen cục bộ cần transformers{version_requirement('transformers')}."
    from .forced_alignment import available_models

    available_devices = [device["id"] for device in devices if device["available"]]
    if not available_devices:
        return [], "Không có thiết bị CPU/CUDA/ROCm/MPS nào có thể chạy căn chỉnh phụ đề Qwen."
    models = [_model(name, available_devices.copy(), [], ["en", "zh"])
              for name in available_models()]
    return models, None if models else "Trọng số hoặc tài nguyên tokenizer của Qwen3-ForcedAligner-0.6B-hf cục bộ không đầy đủ."


def runtime_info() -> dict[str, Any]:
    """Environment metadata without probing model assets or credentials."""
    return {"devices": _detect_devices()}


def probe_capability(adapter: str) -> dict[str, Any]:
    """Inspect exactly one installed provider; no inference or network access."""
    probes = {"whisper": ("asr", _whisper_models), "voxcpm": ("tts", _voxcpm_models),
              "demucs": ("separation", _demucs_models),
              "qwen_forced_aligner": ("subtitle_alignment", _subtitle_alignment_models)}
    if adapter not in probes:
        raise ValueError(f"Unknown Python provider: {adapter}")
    kind, probe = probes[adapter]
    models, reason = probe(_detect_devices())
    return {"adapter": adapter, "capability": kind, "execution": "local",
            "available": bool(models), "unavailable_reason": reason, "models": models}
