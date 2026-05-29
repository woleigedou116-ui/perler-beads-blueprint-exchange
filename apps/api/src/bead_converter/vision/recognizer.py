from uuid import uuid4

import numpy as np
from PIL import Image

from bead_converter.domain.models import (
    BeadProject,
    Cell,
    CellStatus,
    MappingDecision,
    OcrCandidate,
    RGB,
)
from bead_converter.palettes.repository import ConversionResult, PaletteRepository
from bead_converter.vision.color import (
    COLOR_MATCH_REVIEW,
    COLOR_MATCH_STRONG,
    delta_e,
    sample_cell_color,
)
from bead_converter.vision.grid import detect_grid
from bead_converter.vision.ocr import OcrProvider

COLOR_CLUSTER_DISTANCE = 6.0


def _nearest_source_mapping(
    sampled: RGB,
    palette: PaletteRepository,
) -> tuple[ConversionResult | None, float]:
    candidates = [
        mapping for mapping in palette.all_mappings() if mapping.source_rgb is not None
    ]
    if not candidates:
        return None, float("inf")
    mapping = min(
        candidates,
        key=lambda item: delta_e(
            (sampled.r, sampled.g, sampled.b),
            item.source_rgb or (0, 0, 0),
        ),
    )
    distance = delta_e(
        (sampled.r, sampled.g, sampled.b),
        mapping.source_rgb or (0, 0, 0),
    )
    return mapping, distance


def _valid_ocr_candidate(candidates: list[OcrCandidate]) -> OcrCandidate | None:
    valid = [candidate for candidate in candidates if candidate.normalized_code]
    return max(valid, key=lambda candidate: candidate.confidence, default=None)


def _may_contain_bead(crop: Image.Image) -> bool:
    width, height = crop.size
    inset_x = max(1, round(width * 0.18))
    inset_y = max(1, round(height * 0.18))
    interior = np.asarray(
        crop.convert("RGB").crop(
            (inset_x, inset_y, width - inset_x, height - inset_y)
        )
    )
    brightness = interior.mean(axis=2)
    return bool(np.median(brightness) < 248 or np.mean(brightness < 210) > 0.02)


def _cluster_indices(indices: list[int], colors: list[RGB]) -> list[list[int]]:
    clusters: list[list[int]] = []
    for index in indices:
        sampled = colors[index]
        for cluster in clusters:
            representative = colors[cluster[0]]
            if (
                delta_e(
                    (sampled.r, sampled.g, sampled.b),
                    (representative.r, representative.g, representative.b),
                )
                <= COLOR_CLUSTER_DISTANCE
            ):
                cluster.append(index)
                break
        else:
            clusters.append([index])
    return clusters


def recognize_pattern(
    image: Image.Image,
    project_name: str,
    palette: PaletteRepository,
    ocr: OcrProvider,
    source_standard: str = "MARD",
    target_standard: str = "COCO",
) -> BeadProject:
    grid = detect_grid(image)
    crops = [
        image.crop(
            (
                grid.x_lines[column],
                grid.y_lines[row],
                grid.x_lines[column + 1],
                grid.y_lines[row + 1],
            )
        )
        for row in range(grid.rows)
        for column in range(grid.columns)
    ]
    sampled_colors = [sample_cell_color(crop) for crop in crops]
    ocr_indices = [index for index, crop in enumerate(crops) if _may_contain_bead(crop)]
    ocr_clusters = _cluster_indices(ocr_indices, sampled_colors)
    submitted_results = ocr.recognize_cells(
        [crops[cluster[0]] for cluster in ocr_clusters],
        palette.known_source_codes(),
    )
    ocr_by_index = {
        index: result
        for cluster, result in zip(ocr_clusters, submitted_results)
        for index in cluster
    }
    cells: list[Cell] = []
    decisions: dict[str, MappingDecision] = {}

    for index, sampled in enumerate(sampled_colors):
        candidates = ocr_by_index.get(index, [])
        row, column = divmod(index, grid.columns)
        text_choice = _valid_ocr_candidate(candidates)
        nearest, color_distance = _nearest_source_mapping(sampled, palette)
        if text_choice is None and min(sampled.r, sampled.g, sampled.b) >= 245:
            cells.append(
                Cell(
                    row=row,
                    column=column,
                    sampled_color=sampled,
                    ocr_candidates=candidates,
                    status=CellStatus.empty,
                )
            )
            continue

        if text_choice is not None:
            source_code = text_choice.normalized_code or ""
            conversion = palette.convert(source_code, source_standard, target_standard)
            issues: list[str] = []
            status = CellStatus.confirmed
            if conversion.target_code is None:
                issues.append("mapping-missing")
                status = CellStatus.review_required
            elif conversion.requires_review:
                issues.append("mapping-unverified")
                status = CellStatus.review_required
            if (
                conversion.target_code is not None
                and
                conversion.source_rgb is not None
                and delta_e(
                    (sampled.r, sampled.g, sampled.b),
                    conversion.source_rgb,
                )
                >= COLOR_MATCH_REVIEW
            ):
                issues.append("ocr-color-conflict")
                status = CellStatus.review_required
            cells.append(
                Cell(
                    row=row,
                    column=column,
                    sampled_color=sampled,
                    ocr_candidates=candidates,
                    detected_source_code=source_code,
                    confirmed_source_code=source_code if status == CellStatus.confirmed else None,
                    target_code=conversion.target_code,
                    confidence=text_choice.confidence,
                    status=status,
                    issue_reasons=issues,
                )
            )
            if conversion.target_code:
                decisions[source_code] = MappingDecision(
                    source_code=source_code,
                    target_code=conversion.target_code,
                    origin="verified"
                    if not conversion.requires_review
                    else "unverified-reference",
                    confidence=1.0 if not conversion.requires_review else 0.8,
                )
            continue

        if nearest and color_distance < COLOR_MATCH_STRONG:
            cells.append(
                Cell(
                    row=row,
                    column=column,
                    sampled_color=sampled,
                    detected_source_code=nearest.source_code,
                    target_code=nearest.target_code,
                    confidence=0.6,
                    status=CellStatus.review_required,
                    issue_reasons=["color-only-suggestion"],
                )
            )
        else:
            cells.append(
                Cell(
                    row=row,
                    column=column,
                    sampled_color=sampled,
                    ocr_candidates=candidates,
                    status=CellStatus.review_required,
                    issue_reasons=["unreadable-cell"],
                )
            )

    return BeadProject(
        id=uuid4().hex,
        name=project_name,
        source_image_name="uploaded-image",
        source_standard=source_standard,
        target_standard=target_standard,
        palette_version=palette.version,
        grid=grid,
        mappings=list(decisions.values()),
        cells=cells,
    )
