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

    def load(self, project_id: str) -> BeadProject:
        payload = (self.root / project_id / "project.json").read_text(encoding="utf-8")
        return BeadProject.model_validate_json(payload)
