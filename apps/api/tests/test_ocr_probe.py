from scripts.ocr_probe import safe_display_name


def test_safe_display_name_replaces_characters_unsupported_by_console_encoding() -> None:
    assert safe_display_name("日记📖.jpg", "gbk") == "日记?.jpg"
