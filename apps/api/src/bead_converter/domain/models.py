from enum import Enum

from pydantic import BaseModel, Field


class CellStatus(str, Enum):
    confirmed = "confirmed"
    review_required = "review-required"
    empty = "empty"


class RGB(BaseModel):
    r: int = Field(ge=0, le=255)
    g: int = Field(ge=0, le=255)
    b: int = Field(ge=0, le=255)


class GridGeometry(BaseModel):
    rows: int = Field(gt=0)
    columns: int = Field(gt=0)
    bounds: list[int]
    x_lines: list[int]
    y_lines: list[int]


class OcrCandidate(BaseModel):
    text: str
    normalized_code: str | None = None
    confidence: float = Field(ge=0, le=1)


class Cell(BaseModel):
    row: int = Field(ge=0)
    column: int = Field(ge=0)
    sampled_color: RGB | None = None
    ocr_candidates: list[OcrCandidate] = Field(default_factory=list)
    detected_source_code: str | None = None
    confirmed_source_code: str | None = None
    target_code: str | None = None
    confidence: float = Field(default=0, ge=0, le=1)
    status: CellStatus = CellStatus.review_required
    issue_reasons: list[str] = Field(default_factory=list)


class MappingDecision(BaseModel):
    source_code: str
    target_code: str | None = None
    origin: str
    confidence: float = Field(ge=0, le=1)


class BeadProject(BaseModel):
    format_version: int = 1
    id: str
    name: str
    source_image_name: str
    source_standard: str
    target_standard: str
    palette_version: str
    grid: GridGeometry
    mappings: list[MappingDecision] = Field(default_factory=list)
    cells: list[Cell] = Field(default_factory=list)
    export_history: list[str] = Field(default_factory=list)
    source_attribution: str | None = None
