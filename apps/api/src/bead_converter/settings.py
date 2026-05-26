from pathlib import Path


def default_data_root() -> Path:
    return Path(".data") / "projects"
