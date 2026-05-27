import pytest

from bead_converter.vision.grid import GridNotFoundError, detect_grid
from fixtures.generate_patterns import (
    make_colored_grid_pattern,
    make_grid_pattern,
    make_rectangular_grid_with_trailing_legend_lines,
    make_sparse_vertical_grid,
    make_grid_with_missing_inner_line,
    make_plain_image,
)


def test_detect_grid_returns_exact_cell_geometry() -> None:
    image = make_grid_pattern(rows=4, columns=5, cell_size=32)

    grid = detect_grid(image)

    assert (grid.rows, grid.columns) == (4, 5)
    assert len(grid.x_lines) == 6
    assert len(grid.y_lines) == 5


def test_detect_grid_rejects_non_grid_picture() -> None:
    with pytest.raises(GridNotFoundError):
        detect_grid(make_plain_image())


def test_detect_grid_finds_light_lines_through_colored_cells() -> None:
    image = make_colored_grid_pattern(rows=6, columns=7, cell_size=30)

    grid = detect_grid(image)

    assert (grid.rows, grid.columns) == (6, 7)


def test_detect_grid_reconstructs_one_obscured_internal_line() -> None:
    image = make_grid_with_missing_inner_line(rows=5, columns=7, cell_size=30)

    grid = detect_grid(image)

    assert (grid.rows, grid.columns) == (5, 7)


def test_detect_grid_recovers_large_pattern_when_nearly_half_lines_are_obscured() -> None:
    x_lines = [8 + column * 22 for column in range(64)]
    retained = set(range(0, 64, 2)) | {63}
    image = make_sparse_vertical_grid(
        rows=4,
        columns=63,
        x_lines=x_lines,
        y_spacing=22,
        retained_vertical_indices=retained,
    )

    grid = detect_grid(image)

    assert grid.columns == 63


def test_detect_grid_recovers_scaled_grid_with_alternating_pixel_spacing() -> None:
    x_lines = [8 + round(column * 1038 / 50) for column in range(51)]
    retained = {
        0, 1, 2, 5, 6, 7, 8, 9, 12, 13, 14, 17, 18, 19, 22,
        23, 24, 27, 28, 29, 32, 33, 34, 37, 38, 39, 42, 45, 48, 50,
    }
    image = make_sparse_vertical_grid(
        rows=4,
        columns=50,
        x_lines=x_lines,
        y_spacing=21,
        retained_vertical_indices=retained,
    )

    grid = detect_grid(image)

    assert grid.columns == 50


def test_detect_grid_excludes_legend_lines_below_rectangular_pattern() -> None:
    image = make_rectangular_grid_with_trailing_legend_lines(
        rows=40,
        columns=63,
        cell_size=22,
    )

    grid = detect_grid(image)

    assert (grid.rows, grid.columns) == (40, 63)
