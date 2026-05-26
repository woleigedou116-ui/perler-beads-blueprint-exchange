from collections.abc import Callable
from typing import Protocol

import numpy as np
from PIL import Image

from bead_converter.domain.models import OcrCandidate


def normalize_code(raw_text: str, known_codes: set[str]) -> str | None:
    candidate = raw_text.replace(" ", "").upper()
    return candidate if candidate in known_codes else None


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
