from pathlib import Path

from PIL import Image, ImageChops

from scripts.ocr_benchmark import filter_image_paths, preprocess_image


def test_filter_image_paths_keeps_supported_images_matching_name(tmp_path: Path) -> None:
    (tmp_path / "普通图.jpg").write_bytes(b"not actually decoded by this helper")
    (tmp_path / "有水印版.png").write_bytes(b"not actually decoded by this helper")
    (tmp_path / "水印说明.txt").write_text("ignore me", encoding="utf-8")

    paths = filter_image_paths(tmp_path, name_contains="水印")

    assert [path.name for path in paths] == ["有水印版.png"]


def test_contrast_sharpen_preprocess_returns_changed_rgb_image() -> None:
    image = Image.new("RGB", (8, 8), "#808080")
    for x in range(4):
        image.putpixel((x, x), (120, 120, 120))

    processed = preprocess_image(image, "contrast-sharpen")

    assert processed.mode == "RGB"
    assert processed.size == image.size
    assert ImageChops.difference(image, processed).getbbox() is not None
