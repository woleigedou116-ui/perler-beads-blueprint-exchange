from uuid import uuid4

import cv2
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
FUZZY_OCR_MAX_DISTANCE = 1
OCR_COLOR_CONFLICT_REVIEW_CONFIDENCE = 0.85

SourceColorCandidate = tuple[ConversionResult, np.ndarray]


def _rgb_to_lab(rgb: tuple[int, int, int]) -> np.ndarray:
    return cv2.cvtColor(np.asarray([[rgb]], dtype=np.uint8), cv2.COLOR_RGB2LAB).astype(
        float
    )[0, 0]


def _rgb_model_to_lab(rgb: RGB) -> np.ndarray:
    return _rgb_to_lab((rgb.r, rgb.g, rgb.b))


def _lab_distance(left: np.ndarray, right: np.ndarray) -> float:
    return float(np.linalg.norm(left - right))


def _nearest_source_mapping(
    sampled_lab: np.ndarray,
    candidates: list[SourceColorCandidate],
) -> tuple[ConversionResult | None, float]:
    if not candidates:
        return None, float("inf")
    mapping, mapping_lab = min(
        candidates,
        key=lambda item: _lab_distance(sampled_lab, item[1]),
    )
    distance = _lab_distance(sampled_lab, mapping_lab)
    return mapping, distance


def _normalized_ocr_text(raw_text: str) -> str:
    return raw_text.replace(" ", "").upper()


def _edit_distance(left: str, right: str) -> int:
    if left == right:
        return 0
    previous = list(range(len(right) + 1))
    for left_index, left_char in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_char in enumerate(right, start=1):
            current.append(
                min(
                    previous[right_index] + 1,
                    current[right_index - 1] + 1,
                    previous[right_index - 1] + (left_char != right_char),
                )
            )
        previous = current
    return previous[-1]


def _fuzzy_ocr_color_mapping(
    candidates: list[OcrCandidate],
    sampled_lab: np.ndarray,
    mappings: list[SourceColorCandidate],
) -> tuple[ConversionResult | None, float]:
    ranked: list[tuple[int, float, str, ConversionResult]] = []
    for candidate in candidates:
        raw_code = _normalized_ocr_text(candidate.text)
        if not raw_code:
            continue
        for mapping, mapping_lab in mappings:
            if mapping.target_code is None:
                continue
            if raw_code[0] != mapping.source_code[0]:
                continue
            text_distance = _edit_distance(raw_code, mapping.source_code)
            if text_distance > FUZZY_OCR_MAX_DISTANCE:
                continue
            color_distance = _lab_distance(sampled_lab, mapping_lab)
            ranked.append(
                (text_distance, color_distance, mapping.source_code, mapping)
            )
    if not ranked:
        return None, float("inf")
    text_distance, color_distance, _source_code, mapping = min(ranked)
    return mapping, color_distance


def _valid_ocr_candidate(candidates: list[OcrCandidate]) -> OcrCandidate | None:
    valid = [candidate for candidate in candidates if candidate.normalized_code]
    return max(valid, key=lambda candidate: candidate.confidence, default=None)


def _cell_visual_evidence(crop: Image.Image) -> tuple[bool, bool]:
    width, height = crop.size
    inset_x = max(1, round(width * 0.18))
    inset_y = max(1, round(height * 0.18))
    interior = np.asarray(
        crop.convert("RGB").crop(
            (inset_x, inset_y, width - inset_x, height - inset_y)
        )
    )
    brightness = interior.mean(axis=2)
    chroma = interior.max(axis=2) - interior.min(axis=2)
    median_brightness = float(np.median(brightness))
    median_chroma = float(np.median(chroma))
    dark_ink_ratio = float(np.mean(brightness < 165))
    printed_ink_ratio = float(np.mean(brightness < 210))
    may_contain_bead = bool(
        median_brightness < 225
        or median_chroma > 24
        or dark_ink_ratio > 0.006
        or printed_ink_ratio > 0.04
    )
    has_printed_ink = bool(dark_ink_ratio > 0.03 or printed_ink_ratio > 0.08)
    return may_contain_bead, has_printed_ink


def _may_contain_bead(crop: Image.Image) -> bool:
    return _cell_visual_evidence(crop)[0]


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
    ocr_image: Image.Image | None = None,
) -> BeadProject:
    image = image.convert("RGB")
    ocr_source_image = ocr_image.convert("RGB") if ocr_image is not None else image
    if ocr_source_image.size != image.size:
        raise ValueError("ocr_image must have the same size as image")

    grid = detect_grid(image)
    crop_boxes = [
        (
            grid.x_lines[column],
            grid.y_lines[row],
            grid.x_lines[column + 1],
            grid.y_lines[row + 1],
        )
        for row in range(grid.rows)
        for column in range(grid.columns)
    ]
    crops = [
        image.crop(crop_box)
        for crop_box in crop_boxes
    ]
    ocr_crops = [
        ocr_source_image.crop(crop_box)
        for crop_box in crop_boxes
    ]
    sampled_colors = [sample_cell_color(crop) for crop in crops]
    visual_evidence = [_cell_visual_evidence(crop) for crop in crops]
    may_contain_bead = [evidence[0] for evidence in visual_evidence]
    has_printed_ink = [evidence[1] for evidence in visual_evidence]
    ocr_indices = [
        index for index, contains_bead in enumerate(may_contain_bead) if contains_bead
    ]
    ocr_clusters = _cluster_indices(ocr_indices, sampled_colors)
    submitted_results = ocr.recognize_cells(
        [ocr_crops[cluster[0]] for cluster in ocr_clusters],
        palette.known_source_codes(),
    )
    ocr_by_index = {
        index: result
        for cluster, result in zip(ocr_clusters, submitted_results)
        for index in cluster
    }
    cells: list[Cell] = []
    decisions: dict[str, MappingDecision] = {}
    source_color_mappings: list[SourceColorCandidate] | None = None

    def get_source_color_mappings() -> list[SourceColorCandidate]:
        nonlocal source_color_mappings
        if source_color_mappings is None:
            source_color_mappings = [
                (mapping, _rgb_to_lab(mapping.source_rgb))
                for mapping in palette.all_mappings()
                if mapping.source_rgb is not None
            ]
        return source_color_mappings

    for index, sampled in enumerate(sampled_colors):
        candidates = ocr_by_index.get(index, [])
        row, column = divmod(index, grid.columns)
        text_choice = _valid_ocr_candidate(candidates)
        if text_choice is None and (
            not may_contain_bead[index]
            or (
                min(sampled.r, sampled.g, sampled.b) >= 245
                and not has_printed_ink[index]
            )
        ):
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
                and text_choice.confidence < OCR_COLOR_CONFLICT_REVIEW_CONFIDENCE
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

        source_color_candidates = get_source_color_mappings()
        sampled_lab = _rgb_model_to_lab(sampled)
        nearest, color_distance = _nearest_source_mapping(
            sampled_lab,
            source_color_candidates,
        )
        fuzzy, fuzzy_color_distance = _fuzzy_ocr_color_mapping(
            candidates,
            sampled_lab,
            source_color_candidates,
        )
        if fuzzy and fuzzy_color_distance < COLOR_MATCH_STRONG:
            cells.append(
                Cell(
                    row=row,
                    column=column,
                    sampled_color=sampled,
                    ocr_candidates=candidates,
                    detected_source_code=fuzzy.source_code,
                    target_code=fuzzy.target_code,
                    confidence=0.65,
                    status=CellStatus.review_required,
                    issue_reasons=["ocr-fuzzy-color-suggestion"],
                )
            )
        elif nearest and color_distance < COLOR_MATCH_STRONG:
            cells.append(
                Cell(
                    row=row,
                    column=column,
                    sampled_color=sampled,
                    ocr_candidates=candidates,
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
