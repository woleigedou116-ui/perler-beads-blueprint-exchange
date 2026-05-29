from bead_converter.domain.models import CellStatus, OcrCandidate
from bead_converter.palettes.repository import PaletteRepository
from bead_converter.vision.recognizer import recognize_pattern
from fixtures.generate_patterns import make_grid_with_cell_fill


class FirstCellOcr:
    def __init__(self, code: str | None) -> None:
        self.code = code
        self.received_count = 0

    def recognize_cells(self, cell_images, known_codes):
        self.received_count = len(cell_images)
        results = [[] for _cell in cell_images]
        if self.code:
            results[0] = [
                OcrCandidate(
                    text=self.code,
                    normalized_code=self.code,
                    confidence=0.97,
                )
            ]
        return results


def test_matching_ocr_and_color_confirms_cell() -> None:
    image = make_grid_with_cell_fill((14, 14, 14))

    project = recognize_pattern(
        image,
        "黑色测试",
        PaletteRepository.load_default(),
        FirstCellOcr("H7"),
    )

    cell = project.cells[0]
    assert cell.confirmed_source_code == "H7"
    assert cell.target_code == "B09"
    assert cell.status == CellStatus.confirmed


def test_ocr_color_conflict_requires_review() -> None:
    image = make_grid_with_cell_fill((247, 152, 158))

    project = recognize_pattern(
        image,
        "冲突测试",
        PaletteRepository.load_default(),
        FirstCellOcr("H7"),
    )

    cell = project.cells[0]
    assert cell.status == CellStatus.review_required
    assert "ocr-color-conflict" in cell.issue_reasons


def test_unverified_palette_mapping_requires_review() -> None:
    image = make_grid_with_cell_fill((252, 160, 117))

    project = recognize_pattern(
        image,
        "完整色号表待核对映射",
        PaletteRepository.load_default(),
        FirstCellOcr("A12"),
    )

    cell = project.cells[0]
    assert cell.detected_source_code == "A12"
    assert cell.target_code == "K09"
    assert cell.status == CellStatus.review_required
    assert "mapping-unverified" in cell.issue_reasons


def test_color_only_match_is_a_reviewable_suggestion() -> None:
    image = make_grid_with_cell_fill((14, 14, 14))

    project = recognize_pattern(
        image,
        "取色建议",
        PaletteRepository.load_default(),
        FirstCellOcr(None),
    )

    cell = project.cells[0]
    assert cell.detected_source_code == "H7"
    assert cell.target_code == "B09"
    assert cell.status == CellStatus.review_required
    assert "color-only-suggestion" in cell.issue_reasons


def test_empty_grid_cells_are_not_submitted_to_ocr() -> None:
    image = make_grid_with_cell_fill((14, 14, 14))
    ocr = FirstCellOcr("H7")

    recognize_pattern(image, "稀疏图纸", PaletteRepository.load_default(), ocr)

    assert ocr.received_count == 1


def test_repeated_fill_color_is_ocrd_once_and_applied_to_group() -> None:
    image = make_grid_with_cell_fill(
        (247, 152, 158),
        filled_cells=[(0, 0), (1, 1), (2, 2)],
    )
    ocr = FirstCellOcr("F14")

    project = recognize_pattern(image, "重复颜色", PaletteRepository.load_default(), ocr)

    f14_cells = [cell for cell in project.cells if cell.confirmed_source_code == "F14"]
    assert ocr.received_count == 1
    assert len(f14_cells) == 3
