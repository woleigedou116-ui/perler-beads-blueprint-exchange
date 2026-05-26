from statistics import median

import cv2
import numpy as np
from PIL import Image

from bead_converter.domain.models import GridGeometry


class GridNotFoundError(ValueError):
    pass


def _group_positions(values: list[int]) -> list[int]:
    if not values:
        return []
    groups: list[list[int]] = [[values[0]]]
    for value in values[1:]:
        if value <= groups[-1][-1] + 8:
            groups[-1].append(value)
        else:
            groups.append([value])
    return [round(sum(group) / len(group)) for group in groups]


def _regular_lines(lines: list[int]) -> bool:
    if len(lines) < 3:
        return False
    spacings = [right - left for left, right in zip(lines, lines[1:])]
    expected = median(spacings)
    if expected <= 2:
        return False
    return all(abs(spacing - expected) / expected <= 0.15 for spacing in spacings)


def _recover_periodic_lines(lines: list[int]) -> list[int]:
    if len(lines) < 3:
        return lines
    differences = [right - left for left, right in zip(lines, lines[1:])]
    smallest = min(differences)
    nearby = [
        distance
        for distance in differences
        if abs(distance - smallest) / smallest <= 0.15
    ]
    spacing = float(median(nearby))
    if spacing <= 2:
        return lines
    count = round((lines[-1] - lines[0]) / spacing)
    reconstructed = [
        round(value)
        for value in np.linspace(lines[0], lines[-1], count + 1)
    ]
    tolerance = max(2, spacing * 0.15)
    supported = sum(
        any(abs(candidate - expected) <= tolerance for candidate in lines)
        for expected in reconstructed
    )
    if supported < max(3, len(reconstructed) * 0.55):
        return lines
    return reconstructed


def detect_grid(image: Image.Image) -> GridGeometry:
    grayscale = np.asarray(image.convert("L"))
    height, width = grayscale.shape
    edges = cv2.Canny(grayscale, 20, 80)
    kernel_length = max(8, min(width, height) // 20)
    vertical = cv2.morphologyEx(
        edges,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (1, kernel_length)),
    )
    horizontal = cv2.morphologyEx(
        edges,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_length, 1)),
    )

    vertical_candidates = [
        int(x)
        for x in np.flatnonzero(
            np.count_nonzero(vertical, axis=0) >= height * 0.1
        )
    ]
    horizontal_candidates = [
        int(y)
        for y in np.flatnonzero(
            np.count_nonzero(horizontal, axis=1) >= width * 0.1
        )
    ]
    x_lines = _group_positions(vertical_candidates)
    y_lines = _group_positions(horizontal_candidates)
    if not _regular_lines(x_lines):
        x_lines = _recover_periodic_lines(x_lines)
    if _regular_lines(x_lines) and y_lines:
        cell_size = median(
            right - left for left, right in zip(x_lines, x_lines[1:])
        )
        square_end = y_lines[0] + x_lines[-1] - x_lines[0]
        nearest_end = min(y_lines, key=lambda line: abs(line - square_end))
        if abs(nearest_end - square_end) <= cell_size * 0.25:
            y_lines = [
                line for line in y_lines if line <= nearest_end + cell_size * 0.1
            ]
    if not _regular_lines(y_lines):
        y_lines = _recover_periodic_lines(y_lines)

    if not _regular_lines(x_lines) or not _regular_lines(y_lines):
        raise GridNotFoundError("未检测到规则网格")

    return GridGeometry(
        rows=len(y_lines) - 1,
        columns=len(x_lines) - 1,
        bounds=[x_lines[0], y_lines[0], x_lines[-1], y_lines[-1]],
        x_lines=x_lines,
        y_lines=y_lines,
    )
