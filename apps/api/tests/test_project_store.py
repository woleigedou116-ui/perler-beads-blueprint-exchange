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


def test_project_round_trip_retains_manual_correction(tmp_path: Path) -> None:
    project = BeadProject(
        id="whale-1",
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
    reopened = store.load("whale-1")

    assert reopened.cells[0].target_code == "B09"
    assert reopened.cells[0].status == CellStatus.confirmed
    assert reopened.cells[0].issue_reasons == ["user-corrected"]
