import pytest

from bead_converter.vision.grid import GridNotFoundError, detect_grid
from fixtures.generate_patterns import (
    make_colored_grid_pattern,
    make_grid_pattern,
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
