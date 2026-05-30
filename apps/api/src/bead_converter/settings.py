from pathlib import Path
import sys


def resource_path(*parts: str) -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS).joinpath(*parts)
    return Path(__file__).resolve().parents[4].joinpath(*parts)


def default_data_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / ".data" / "projects"
    return Path(".data") / "projects"


def palette_file_path() -> Path:
    return resource_path("data", "palettes", "mard-coco.v1.json")


def web_dist_path() -> Path:
    return resource_path("apps", "web", "dist")
