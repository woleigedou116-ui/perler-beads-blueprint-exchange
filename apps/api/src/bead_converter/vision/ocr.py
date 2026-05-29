from collections.abc import Callable
from pathlib import Path
import subprocess
import tempfile
from typing import Protocol

import numpy as np
from PIL import Image, ImageOps

from bead_converter.domain.models import OcrCandidate


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
    ) -> None:
        if engine is None:
            from rapidocr import RapidOCR

            engine = RapidOCR()
        self._engine = engine

    def recognize_cells(
        self,
        cell_images: list[Image.Image],
        known_codes: set[str],
    ) -> list[list[OcrCandidate]]:
        results: list[list[OcrCandidate]] = []
        for cell in cell_images:
            enlarged = cell.resize(
                (cell.width * 3, cell.height * 3),
                Image.Resampling.LANCZOS,
            )
            lines = _result_lines(self._engine(np.asarray(enlarged.convert("RGB"))))
            results.append(
                [
                    OcrCandidate(
                        text=text,
                        normalized_code=normalize_code(text, known_codes),
                        confidence=max(0.0, min(1.0, score)),
                    )
                    for text, score in lines
                ]
            )
        return results


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
