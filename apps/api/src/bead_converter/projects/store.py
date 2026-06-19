from io import BytesIO
from pathlib import Path
import re
from uuid import uuid4
from zipfile import ZIP_DEFLATED, BadZipFile, ZipFile

from pydantic import ValidationError

from bead_converter.domain.models import BeadProject

MAX_ARCHIVE_ENTRY_BYTES = 64 * 1024 * 1024
MAX_PROJECT_CELLS = 100_000
PROJECT_ID_RE = re.compile(r"^[0-9a-f]{32}$")


class ProjectStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    def save(self, project: BeadProject) -> None:
        folder = self._safe_project_dir(project.id)
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "project.json").write_text(
            project.model_dump_json(indent=2),
            encoding="utf-8",
        )

    def save_source_image(self, project_id: str, filename: str, data: bytes) -> Path:
        suffix = Path(filename).suffix.lower()
        if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            suffix = ".img"
        folder = self._safe_project_dir(project_id)
        folder.mkdir(parents=True, exist_ok=True)
        destination = folder / f"source{suffix}"
        destination.write_bytes(data)
        return destination

    def load(self, project_id: str) -> BeadProject:
        payload = (self._safe_project_dir(project_id) / "project.json").read_text(
            encoding="utf-8",
        )
        return BeadProject.model_validate_json(payload)

    def source_image_path(self, project_id: str) -> Path:
        images = sorted(self._safe_project_dir(project_id).glob("source.*"))
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
                self._validate_archive_entries(bundle)
                project = BeadProject.model_validate_json(bundle.read("project.json"))
                if project.format_version != 1:
                    raise ValueError("unsupported project format_version")
                if len(project.cells) > MAX_PROJECT_CELLS:
                    raise ValueError("project contains too many cells")
                source_entries = [
                    name
                    for name in bundle.namelist()
                    if Path(name).name == name and name.startswith("source.")
                ]
                if not source_entries:
                    raise ValueError("project archive does not include a source image")
                source_name = source_entries[0]
                source_data = bundle.read(source_name)
        except (BadZipFile, KeyError, ValidationError) as exc:
            raise ValueError("invalid beadproject archive") from exc

        project = project.model_copy(update={"id": uuid4().hex})
        self.save(project)
        self.save_source_image(project.id, source_name, source_data)
        return project

    def _safe_project_dir(self, project_id: str) -> Path:
        if not PROJECT_ID_RE.fullmatch(project_id):
            raise ValueError("invalid project id")
        return self.root / project_id

    def _validate_archive_entries(self, bundle: ZipFile) -> None:
        for info in bundle.infolist():
            if info.file_size > MAX_ARCHIVE_ENTRY_BYTES:
                raise ValueError("beadproject archive entry is too large")
