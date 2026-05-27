from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

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

    def source_image_path(self, project_id: str) -> Path:
        images = sorted((self.root / project_id).glob("source.*"))
        if not images:
            raise FileNotFoundError(f"source image missing for project {project_id}")
        return images[0]

    def export_archive(self, project_id: str) -> bytes:
        project = self.load(project_id)
        source_image = self.source_image_path(project_id)
        output = BytesIO()
        with ZipFile(output, "w", ZIP_DEFLATED) as bundle:
            bundle.writestr("project.json", project.model_dump_json(indent=2))
            bundle.write(source_image, source_image.name)
        return output.getvalue()

    def import_archive(self, data: bytes) -> BeadProject:
        try:
            with ZipFile(BytesIO(data)) as bundle:
                project = BeadProject.model_validate_json(bundle.read("project.json"))
                if project.format_version != 1:
                    raise ValueError("unsupported project format_version")
                source_entries = [
                    name
                    for name in bundle.namelist()
                    if Path(name).name == name and name.startswith("source.")
                ]
                if not source_entries:
                    raise ValueError("project archive does not include a source image")
                source_name = source_entries[0]
                source_data = bundle.read(source_name)
        except (BadZipFile, KeyError) as exc:
            raise ValueError("invalid beadproject archive") from exc

        self.save(project)
        self.save_source_image(project.id, source_name, source_data)
        return project
