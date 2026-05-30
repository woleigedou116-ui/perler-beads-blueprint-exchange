from dataclasses import dataclass
import json

from bead_converter.settings import palette_file_path


@dataclass(frozen=True)
class ConversionResult:
    source_code: str
    source_rgb: tuple[int, int, int] | None
    target_code: str | None
    target_rgb: tuple[int, int, int] | None
    requires_review: bool


class PaletteRepository:
    def __init__(self, mappings: dict[str, ConversionResult], version: str) -> None:
        self._mappings = mappings
        self.version = version

    @classmethod
    def load_default(cls) -> "PaletteRepository":
        payload = json.loads(palette_file_path().read_text(encoding="utf-8"))
        mappings = {
            row["sourceCode"]: ConversionResult(
                source_code=row["sourceCode"],
                source_rgb=tuple(row["sourceRgb"]),
                target_code=row["targetCode"],
                target_rgb=tuple(row["targetRgb"]),
                requires_review=not row["verified"],
            )
            for row in payload["mappings"]
        }
        return cls(mappings=mappings, version=payload["version"])

    def convert(
        self,
        code: str,
        source_standard: str,
        target_standard: str,
    ) -> ConversionResult:
        if source_standard != "MARD" or target_standard != "COCO":
            return ConversionResult(code, None, None, None, True)
        return self._mappings.get(
            code,
            ConversionResult(code, None, None, None, True),
        )

    def known_source_codes(self) -> set[str]:
        return set(self._mappings)

    def all_mappings(self) -> list[ConversionResult]:
        return list(self._mappings.values())
