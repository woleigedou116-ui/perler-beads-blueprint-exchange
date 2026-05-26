from bead_converter.palettes.repository import PaletteRepository


def test_verified_reference_mappings_are_available() -> None:
    repo = PaletteRepository.load_default()

    assert repo.convert("H2", "MARD", "COCO").target_code == "A01"
    assert repo.convert("H7", "MARD", "COCO").target_code == "B09"
    assert repo.convert("F14", "MARD", "COCO").target_code == "K07"


def test_mapping_includes_display_colors_for_recognition_and_redraw() -> None:
    result = PaletteRepository.load_default().convert("H7", "MARD", "COCO")

    assert result.source_rgb is not None
    assert result.target_rgb is not None


def test_unknown_mapping_returns_review_candidate_not_silent_conversion() -> None:
    result = PaletteRepository.load_default().convert("UNKNOWN", "MARD", "COCO")

    assert result.target_code is None
    assert result.requires_review is True
