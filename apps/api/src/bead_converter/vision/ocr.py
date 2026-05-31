from collections.abc import Callable
import hashlib
from pathlib import Path
import subprocess
import tempfile
from time import perf_counter
from typing import Protocol

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from bead_converter.domain.models import OcrCandidate

DEFAULT_RAPIDOCR_PARAMS = {
    "EngineConfig.onnxruntime.intra_op_num_threads": 2,
    "EngineConfig.onnxruntime.inter_op_num_threads": 1,
}


def normalize_code(raw_text: str, known_codes: set[str]) -> str | None:
    candidate = raw_text.replace(" ", "").upper()
    if candidate in known_codes:
        return candidate
    alternatives = _common_ocr_alternatives(candidate)
    matches = sorted(alternative for alternative in alternatives if alternative in known_codes)
    return matches[0] if len(matches) == 1 else None


def _common_ocr_alternatives(candidate: str) -> set[str]:
    alternatives: set[str] = set()
    if not candidate:
        return alternatives
    if candidate[0] == "8":
        alternatives.add(f"B{candidate[1:]}")
    if len(candidate) > 1 and candidate[-1] == "8":
        alternatives.add(f"{candidate[:-1]}0")
    return alternatives


class OcrProvider(Protocol):
    def recognize_cells(
        self,
        cell_images: list[Image.Image],
        known_codes: set[str],
    ) -> list[list[OcrCandidate]]: ...


def _result_lines(result: object) -> list[tuple[str, float]]:
    if hasattr(result, "txts") and hasattr(result, "scores"):
        if not result.txts:
            return []
        return list(zip(result.txts, result.scores))
    payload = result[0] if isinstance(result, tuple) else result
    if not payload:
        return []
    return [(line[1], float(line[2])) for line in payload]


class RapidOcrProvider:
    def __init__(
        self,
        engine: Callable[[np.ndarray], object] | None = None,
        profile: str = "standard",
        cache_enabled: bool = False,
    ) -> None:
        if engine is None:
            from rapidocr import RapidOCR

            engine = RapidOCR(params=DEFAULT_RAPIDOCR_PARAMS)
        self._engine = engine
        if profile not in {"standard", "watermark"}:
            raise ValueError(f"Unsupported RapidOCR profile: {profile}")
        self._profile = profile
        self._cache_enabled = cache_enabled
        self._cache: dict[tuple[str, tuple[str, ...]], list[OcrCandidate]] = {}
        self.last_engine_call_durations_ms: list[float] = []

    def recognize_cells(
        self,
        cell_images: list[Image.Image],
        known_codes: set[str],
    ) -> list[list[OcrCandidate]]:
        results: list[list[OcrCandidate]] = []
        known_codes_key = tuple(sorted(known_codes))
        self.last_engine_call_durations_ms = []
        for cell in cell_images:
            candidates_by_key: dict[tuple[str, str | None], OcrCandidate] = {}
            for prepared in self._prepare_cell_variants(cell):
                rgb_prepared = prepared.convert("RGB")
                cache_key: tuple[str, tuple[str, ...]] | None = None
                if self._cache_enabled:
                    cache_key = (_image_cache_key(rgb_prepared), known_codes_key)
                    cached = self._cache.get(cache_key)
                    if cached is not None:
                        for candidate in cached:
                            candidates_by_key[
                                (candidate.text, candidate.normalized_code)
                            ] = candidate
                        continue
                engine_start = perf_counter()
                raw_result = self._engine(np.asarray(rgb_prepared))
                self.last_engine_call_durations_ms.append(
                    round((perf_counter() - engine_start) * 1000, 1)
                )
                lines = _result_lines(raw_result)
                prepared_candidates: list[OcrCandidate] = []
                for text, score in lines:
                    candidate = OcrCandidate(
                        text=text,
                        normalized_code=normalize_code(text, known_codes),
                        confidence=max(0.0, min(1.0, score)),
                    )
                    prepared_candidates.append(candidate)
                    key = (candidate.text, candidate.normalized_code)
                    previous = candidates_by_key.get(key)
                    if previous is None or candidate.confidence > previous.confidence:
                        candidates_by_key[key] = candidate
                if cache_key is not None:
                    self._cache[cache_key] = prepared_candidates
            results.append(
                sorted(
                    candidates_by_key.values(),
                    key=lambda candidate: candidate.confidence,
                    reverse=True,
                )
            )
        return results

    def _prepare_cell_variants(self, cell: Image.Image) -> list[Image.Image]:
        enlarged = cell.resize(
            (cell.width * 3, cell.height * 3),
            Image.Resampling.LANCZOS,
        )
        if self._profile == "standard":
            return [enlarged]

        large = cell.resize(
            (cell.width * 5, cell.height * 5),
            Image.Resampling.LANCZOS,
        )
        grayscale = ImageOps.grayscale(large)
        contrast = ImageOps.autocontrast(grayscale)
        sharpened = ImageEnhance.Contrast(contrast).enhance(1.25).filter(
            ImageFilter.UnsharpMask(radius=1.2, percent=180, threshold=3)
        )
        threshold = sharpened.point(lambda value: 255 if value >= 150 else 0)
        return [
            enlarged,
            contrast.convert("RGB"),
            sharpened.convert("RGB"),
            threshold.convert("RGB"),
        ]


def _image_cache_key(image: Image.Image) -> str:
    return hashlib.sha256(
        image.size[0].to_bytes(4, "big")
        + image.size[1].to_bytes(4, "big")
        + image.tobytes()
    ).hexdigest()


class TesseractOcrProvider:
    def __init__(
        self,
        command: str = "tesseract",
        runner: Callable[..., object] | None = None,
        scale: int = 5,
        assumed_confidence: float = 0.91,
    ) -> None:
        self._command = command
        self._runner = runner or subprocess.run
        self._scale = scale
        self._assumed_confidence = assumed_confidence

    def recognize_cells(
        self,
        cell_images: list[Image.Image],
        known_codes: set[str],
    ) -> list[list[OcrCandidate]]:
        results: list[list[OcrCandidate]] = []
        with tempfile.TemporaryDirectory() as directory:
            temp_dir = Path(directory)
            for index, cell in enumerate(cell_images):
                image_path = temp_dir / f"cell-{index}.png"
                prepared = self._prepare_cell(cell)
                prepared.save(image_path)
                command = [
                    self._command,
                    str(image_path),
                    "stdout",
                    "--psm",
                    "7",
                    "--oem",
                    "1",
                    "-c",
                    "tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
                ]
                completed = self._runner(
                    command,
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if getattr(completed, "returncode", 1) != 0:
                    results.append([])
                    continue
                raw_text = "".join(str(getattr(completed, "stdout", "")).split())
                if not raw_text:
                    results.append([])
                    continue
                results.append(
                    [
                        OcrCandidate(
                            text=raw_text,
                            normalized_code=normalize_code(raw_text, known_codes),
                            confidence=self._assumed_confidence,
                        )
                    ]
                )
        return results

    def _prepare_cell(self, cell: Image.Image) -> Image.Image:
        enlarged = cell.resize(
            (cell.width * self._scale, cell.height * self._scale),
            Image.Resampling.LANCZOS,
        )
        grayscale = ImageOps.grayscale(enlarged)
        return ImageOps.autocontrast(grayscale)
