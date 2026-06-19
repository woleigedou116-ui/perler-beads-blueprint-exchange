from pathlib import Path

from bead_converter.domain.models import (
    BeadProject,
    Cell,
    CellStatus,
    GridGeometry,
    MappingDecision,
    RGB,
)
from bead_converter.projects.store import ProjectStore

PROJECT_ID = "0123456789abcdef0123456789abcdef"


def test_project_round_trip_retains_manual_correction(tmp_path: Path) -> None:
    project = BeadProject(
        id=PROJECT_ID,
        name="鲸鱼图纸",
        source_image_name="source.png",
        source_standard="MARD",
        target_standard="COCO",
        palette_version="mard-coco.v1",
        grid=GridGeometry(
            rows=1,
            columns=1,
            bounds=[0, 0, 20, 20],
            x_lines=[0, 20],
            y_lines=[0, 20],
        ),
        mappings=[
            MappingDecision(
                source_code="H7",
                target_code="B09",
                origin="user-confirmed",
                confidence=1.0,
            )
        ],
        cells=[
            Cell(
                row=0,
                column=0,
                sampled_color=RGB(r=10, g=10, b=10),
                confirmed_source_code="H7",
                target_code="B09",
                confidence=1.0,
                status=CellStatus.confirmed,
                issue_reasons=["user-corrected"],
            )
        ],
    )
    store = ProjectStore(tmp_path)

    store.save(project)
    reopened = store.load(PROJECT_ID)

    assert reopened.cells[0].target_code == "B09"
    assert reopened.cells[0].status == CellStatus.confirmed
    assert reopened.cells[0].issue_reasons == ["user-corrected"]


def test_project_store_rejects_invalid_project_ids(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path)
    outside = tmp_path.parent / "project.json"
    outside.write_text("outside", encoding="utf-8")

    invalid_ids = ["../foo", "..\\foo", "not-hex", "", "0123456789abcdef0123456789abcdeg"]
    for project_id in invalid_ids:
        try:
            store.load(project_id)
        except ValueError:
            pass
        else:
            raise AssertionError(f"{project_id!r} must be rejected")

    assert outside.read_text(encoding="utf-8") == "outside"
