import sys
from pathlib import Path

from bead_converter import settings


def test_resource_path_uses_pyinstaller_bundle_root(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert settings.resource_path("data", "palettes") == tmp_path / "data" / "palettes"


def test_default_data_root_is_next_to_frozen_executable(monkeypatch, tmp_path) -> None:
    executable = tmp_path / "拼豆图纸转换工具.exe"
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "executable", str(executable))

    assert settings.default_data_root() == tmp_path / ".data" / "projects"


def test_palette_file_path_points_to_packaged_palette(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert settings.palette_file_path() == (
        tmp_path / "data" / "palettes" / "mard-coco.v1.json"
    )


def test_web_dist_path_points_to_packaged_frontend(monkeypatch, tmp_path) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)

    assert settings.web_dist_path() == tmp_path / "apps" / "web" / "dist"
