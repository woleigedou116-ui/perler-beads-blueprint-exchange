from PIL import ImageDraw

from bead_converter.domain.models import CellStatus, OcrCandidate
from bead_converter.palettes.repository import ConversionResult, PaletteRepository
from bead_converter.vision.recognizer import recognize_pattern
from fixtures.generate_patterns import make_grid_pattern, make_grid_with_cell_fill


class FirstCellOcr:
    def __init__(self, code: str | None, confidence: float = 0.97) -> None:
        self.code = code
        self.confidence = confidence
        self.received_count = 0

    def recognize_cells(self, cell_images, known_codes):
        self.received_count = len(cell_images)
        results = [[] for _cell in cell_images]
        if self.code:
            results[0] = [
                OcrCandidate(
                    text=self.code,
                    normalized_code=self.code,
                    confidence=self.confidence,
                )
            ]
        return results


class RawTextOcr:
    def __init__(self, text: str) -> None:
        self.text = text

    def recognize_cells(self, cell_images, known_codes):
        return [
            [
                OcrCandidate(
                    text=self.text,
                    normalized_code=None,
                    confidence=0.98,
                )
            ]
            for _cell in cell_images
        ]


class InspectingOcr:
    def __init__(self) -> None:
        self.center_pixel: tuple[int, int, int] | None = None

    def recognize_cells(self, cell_images, known_codes):
        first = cell_images[0].convert("RGB")
        self.center_pixel = first.getpixel((first.width // 2, first.height // 2))
        return [[OcrCandidate(text="H7", normalized_code="H7", confidence=0.99)]]


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
        FirstCellOcr("H7", confidence=0.72),
    )

    cell = project.cells[0]
    assert cell.status == CellStatus.review_required
    assert "ocr-color-conflict" in cell.issue_reasons


def test_high_confidence_ocr_is_not_blocked_by_color_conflict() -> None:
    image = make_grid_with_cell_fill((95, 195, 174))

    project = recognize_pattern(
        image,
        "高置信 OCR 优先",
        PaletteRepository.load_default(),
        FirstCellOcr("B18", confidence=0.98),
    )

    cell = project.cells[0]
    assert cell.detected_source_code == "B18"
    assert cell.target_code == "F07"
    assert cell.status == CellStatus.confirmed
    assert "ocr-color-conflict" not in cell.issue_reasons


def test_moderate_confidence_ocr_is_not_blocked_by_palette_color_variance() -> None:
    image = make_grid_with_cell_fill((9, 140, 121))

    project = recognize_pattern(
        image,
        "屏幕色差 OCR 优先",
        PaletteRepository.load_default(),
        FirstCellOcr("B7", confidence=0.868),
    )

    cell = project.cells[0]
    assert cell.detected_source_code == "B7"
    assert cell.target_code == "G05"
    assert cell.status == CellStatus.confirmed
    assert "ocr-color-conflict" not in cell.issue_reasons


def test_unverified_palette_mapping_requires_review() -> None:
    image = make_grid_with_cell_fill((252, 160, 117))
    palette = PaletteRepository(
        mappings={
            "A12": ConversionResult(
                source_code="A12",
                source_rgb=(252, 160, 117),
                target_code="K09",
                target_rgb=(253, 158, 116),
                requires_review=True,
            )
        },
        version="test-unverified",
    )

    project = recognize_pattern(
        image,
        "完整色号表待核对映射",
        palette,
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


def test_invalid_ocr_text_guides_ambiguous_color_suggestion() -> None:
    palette = PaletteRepository.load_default()
    e20 = palette.convert("E20", "MARD", "COCO")
    assert e20.source_rgb is not None
    image = make_grid_with_cell_fill(e20.source_rgb)
    draw = ImageDraw.Draw(image)
    draw.text((15, 17), "E28", fill=(90, 90, 90))

    project = recognize_pattern(
        image,
        "E20 近似色纠错",
        palette,
        RawTextOcr("E28"),
    )

    cell = project.cells[0]
    assert cell.detected_source_code == "E20"
    assert cell.target_code == "K26"
    assert cell.status == CellStatus.review_required
    assert "ocr-fuzzy-color-suggestion" in cell.issue_reasons
    assert cell.ocr_candidates[0].text == "E28"


def test_empty_grid_cells_are_not_submitted_to_ocr() -> None:
    image = make_grid_with_cell_fill((14, 14, 14))
    ocr = FirstCellOcr("H7")

    recognize_pattern(image, "稀疏图纸", PaletteRepository.load_default(), ocr)

    assert ocr.received_count == 1


def test_faint_watermark_on_empty_grid_stays_empty() -> None:
    image = make_grid_pattern(rows=3, columns=3)
    draw = ImageDraw.Draw(image)
    draw.rectangle((10, 10, 38, 38), fill=(240, 230, 225))
    ocr = FirstCellOcr(None)

    project = recognize_pattern(image, "空白水印", PaletteRepository.load_default(), ocr)

    assert ocr.received_count == 0
    assert {cell.status for cell in project.cells} == {CellStatus.empty}


def test_light_bead_with_unread_ink_gets_color_suggestion() -> None:
    palette = PaletteRepository.load_default()
    h2 = palette.convert("H2", "MARD", "COCO")
    assert h2.source_rgb is not None
    image = make_grid_with_cell_fill(h2.source_rgb)
    draw = ImageDraw.Draw(image)
    draw.text((15, 17), "H2", fill=(90, 90, 90))

    project = recognize_pattern(
        image,
        "白色珠子未读字",
        palette,
        FirstCellOcr(None),
    )

    cell = project.cells[0]
    assert cell.status == CellStatus.review_required
    assert cell.detected_source_code == "H2"
    assert cell.target_code == "A01"
    assert "color-only-suggestion" in cell.issue_reasons


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


def test_ocr_image_is_used_only_for_ocr_crops() -> None:
    image = make_grid_with_cell_fill((14, 14, 14))
    ocr_image = image.copy()
    draw = ImageDraw.Draw(ocr_image)
    draw.rectangle((9, 9, 39, 39), fill=(247, 152, 158))
    ocr = InspectingOcr()

    project = recognize_pattern(
        image,
        "OCR 预处理隔离",
        PaletteRepository.load_default(),
        ocr,
        ocr_image=ocr_image,
    )

    cell = project.cells[0]
    assert ocr.center_pixel == (247, 152, 158)
    assert (cell.sampled_color.r, cell.sampled_color.g, cell.sampled_color.b) == (
        14,
        14,
        14,
    )
    assert project.grid.rows == 3
    assert project.grid.columns == 3
