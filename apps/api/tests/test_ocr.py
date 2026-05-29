from PIL import Image

from bead_converter.vision.ocr import RapidOcrProvider, TesseractOcrProvider, normalize_code


def test_normalize_code_accepts_only_known_mard_pattern() -> None:
    known = {"H7", "H2", "F14", "D5"}

    assert normalize_code(" h7 ", known) == "H7"
    assert normalize_code("F14", known) == "F14"
    assert normalize_code("D S", known) is None


def test_normalize_code_recovers_common_cell_ocr_confusions() -> None:
    known = {"B7", "H7", "E20", "E18"}

    assert normalize_code("87", known) == "B7"
    assert normalize_code("E28", known) == "E20"
    assert normalize_code("E18", known) == "E18"


def test_provider_preserves_raw_text_and_normalizes_known_candidate() -> None:
    def fake_engine(_image):
        return ([[[], " h7 ", 0.93], [[], "watermark", 0.88]], 0.01)

    provider = RapidOcrProvider(engine=fake_engine)
    results = provider.recognize_cells(
        [Image.new("RGB", (24, 24), "white")],
        {"H7"},
    )

    assert results[0][0].text == " h7 "
    assert results[0][0].normalized_code == "H7"
    assert results[0][1].normalized_code is None


def test_watermark_profile_tries_additional_cell_preparations() -> None:
    calls = []

    def fake_engine(image):
        calls.append(image.shape)
        if len(calls) == 1:
            return ([], 0.01)
        return ([[[], " h7 ", 0.93]], 0.01)

    provider = RapidOcrProvider(engine=fake_engine, profile="watermark")
    results = provider.recognize_cells(
        [Image.new("RGB", (24, 24), "#f0e2e6")],
        {"H7"},
    )

    assert len(calls) > 1
    assert results[0][0].normalized_code == "H7"


def test_provider_treats_engine_empty_output_as_no_candidates() -> None:
    class EmptyOutput:
        txts = None
        scores = None

    provider = RapidOcrProvider(engine=lambda _image: EmptyOutput())

    assert provider.recognize_cells([Image.new("RGB", (24, 24), "white")], {"H7"}) == [
        []
    ]


def test_tesseract_provider_uses_whitelist_and_normalizes_output() -> None:
    calls = []

    def fake_runner(command, **_kwargs):
        calls.append(command)

        class Result:
            returncode = 0
            stdout = " 87\n"
            stderr = ""

        return Result()

    provider = TesseractOcrProvider(command="fake-tesseract", runner=fake_runner)
    results = provider.recognize_cells(
        [Image.new("RGB", (24, 24), "white")],
        {"B7"},
    )

    assert results[0][0].text == "87"
    assert results[0][0].normalized_code == "B7"
    assert results[0][0].confidence == 0.91
    assert calls[0][0] == "fake-tesseract"
    assert "stdout" in calls[0]
    assert "tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" in calls[0]


def test_tesseract_provider_returns_no_candidates_for_empty_output() -> None:
    def fake_runner(_command, **_kwargs):
        class Result:
            returncode = 0
            stdout = "\n"
            stderr = ""

        return Result()

    provider = TesseractOcrProvider(command="fake-tesseract", runner=fake_runner)

    assert provider.recognize_cells([Image.new("RGB", (24, 24), "white")], {"B7"}) == [
        []
    ]
