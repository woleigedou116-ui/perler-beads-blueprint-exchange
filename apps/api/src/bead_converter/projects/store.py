from pathlib import Path

from bead_converter.domain.models import BeadProject


class ProjectStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def save(self, project: BeadProject) -> None:
        folder = self.root / project.id
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "project.json").write_text(
            project.model_dump_json(indent=2),
            encoding="utf-8",
        )

    def save_source_image(self, project_id: str, filename: str, data: bytes) -> Path:
        suffix = Path(filename).suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            suffix = ".img"
        folder = self.root / project_id
        folder.mkdir(parents=True, exist_ok=True)
        destination = folder / f"source{suffix}"
        destination.write_bytes(data)
        return destination

    def load(self, project_id: str) -> BeadProject:
        payload = (self.root / project_id / "project.json").read_text(encoding="utf-8")
        return BeadProject.model_validate_json(payload)
