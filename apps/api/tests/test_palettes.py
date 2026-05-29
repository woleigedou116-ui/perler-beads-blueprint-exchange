from bead_converter.palettes.repository import PaletteRepository


def test_verified_reference_mappings_are_available() -> None:
    repo = PaletteRepository.load_default()

    assert repo.convert("H2", "MARD", "COCO").target_code == "A01"
    assert repo.convert("H7", "MARD", "COCO").target_code == "B09"
    assert repo.convert("F14", "MARD", "COCO").target_code == "K07"


def test_complete_reference_table_is_available_for_palette_lookup() -> None:
    repo = PaletteRepository.load_default()

    assert len(repo.all_mappings()) >= 280
    assert repo.convert("A1", "MARD", "COCO").target_code == "E02"
    assert repo.convert("M9", "MARD", "COCO").target_code == "Y09"
    assert repo.convert("M10", "MARD", "COCO").target_code == "Y10"
    assert repo.convert("R28", "MARD", "COCO").target_code == "S15"
    assert repo.convert("Y5", "MARD", "COCO").target_code == "N05"


def test_default_reference_table_has_been_manually_reviewed() -> None:
    repo = PaletteRepository.load_default()

    assert all(not mapping.requires_review for mapping in repo.all_mappings())


def test_mapping_includes_display_colors_for_recognition_and_redraw() -> None:
    result = PaletteRepository.load_default().convert("H7", "MARD", "COCO")

    assert result.source_rgb is not None
    assert result.target_rgb is not None


def test_display_colors_are_not_blank_for_colored_reference_rows() -> None:
    repo = PaletteRepository.load_default()

    f2 = repo.convert("F2", "MARD", "COCO")
    f5 = repo.convert("F5", "MARD", "COCO")
    f6 = repo.convert("F6", "MARD", "COCO")

    assert f2.source_rgb is not None and min(f2.source_rgb) < 245
    assert f5.source_rgb is not None and min(f5.source_rgb) < 245
    assert f6.target_rgb is not None and min(f6.target_rgb) < 245


def test_unknown_mapping_returns_review_candidate_not_silent_conversion() -> None:
    result = PaletteRepository.load_default().convert("UNKNOWN", "MARD", "COCO")

    assert result.target_code is None
    assert result.requires_review is True
