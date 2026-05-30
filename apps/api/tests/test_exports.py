from io import BytesIO
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image

from bead_converter.domain.models import (
    BeadProject,
    Cell,
    CellStatus,
    GridGeometry,
    MappingDecision,
)
from bead_converter.exports.csv_export import export_mapping_csv
from bead_converter.exports.image_export import (
    CELL_SIZE,
    PADDING,
    STAT_LINE_HEIGHT,
    render_clean_pattern,
    render_overlay_pattern,
)
from bead_converter.palettes.repository import PaletteRepository
from bead_converter.projects.store import ProjectStore


def confirmed_project() -> BeadProject:
    return BeadProject(
        id="export-project",
        name="导出图纸",
        source_image_name="source.png",
        source_standard="MARD",
        target_standard="COCO",
        palette_version="mard-coco.v1",
        grid=GridGeometry(
            rows=1,
            columns=2,
            bounds=[0, 0, 60, 30],
            x_lines=[0, 30, 60],
            y_lines=[0, 30],
        ),
        mappings=[
            MappingDecision(
                source_code="H7",
                target_code="B09",
                origin="verified",
                confidence=1,
            ),
            MappingDecision(
                source_code="F14",
                target_code="K07",
                origin="verified",
                confidence=1,
            ),
        ],
        cells=[
            Cell(
                row=0,
                column=0,
                confirmed_source_code="H7",
                target_code="B09",
                confidence=1,
                status=CellStatus.confirmed,
            ),
            Cell(
                row=0,
                column=1,
                confirmed_source_code="F14",
                target_code="K07",
                confidence=1,
                status=CellStatus.confirmed,
            ),
        ],
    )


def project_with_unwanted_cell() -> BeadProject:
    project = confirmed_project()
    unwanted = project.cells[1]
    unwanted.status = CellStatus.empty
    unwanted.detected_source_code = None
    unwanted.confirmed_source_code = None
    unwanted.target_code = None
    unwanted.confidence = 0
    unwanted.ocr_candidates = []
    unwanted.issue_reasons.append("user-marked-unwanted")
    return project


def test_csv_export_summarizes_target_bead_counts() -> None:
    data = export_mapping_csv(confirmed_project()).decode("utf-8-sig")

    assert "来源色号,目标色号,数量,确认状态" in data
    assert "H7,B09,1,confirmed" in data
    assert "F14,K07,1,confirmed" in data


def test_csv_export_excludes_unwanted_cells_from_counts() -> None:
    data = export_mapping_csv(project_with_unwanted_cell()).decode("utf-8-sig")

    assert "H7,B09,1,confirmed" in data
    assert "F14" not in data
    assert "K07" not in data
    assert "user-marked-unwanted" not in data


def test_clean_and_overlay_exports_render_images() -> None:
    project = confirmed_project()
    project.cells[1].status = CellStatus.review_required
    clean = render_clean_pattern(project, PaletteRepository.load_default())
    overlay = render_overlay_pattern(
        project,
        Image.new("RGB", (60, 30), "white"),
    )

    assert clean.size[0] > 0
    assert overlay.getpixel((45, 15)) != (255, 255, 255)


def test_clean_and_overlay_exports_do_not_render_unwanted_as_bead_cells() -> None:
    project = project_with_unwanted_cell()
    project.cells[0].status = CellStatus.review_required

    clean = render_clean_pattern(
        project,
        PaletteRepository.load_default(),
        include_color_stats=False,
    )
    overlay = render_overlay_pattern(
        project,
        Image.new("RGB", (60, 30), "white"),
    )

    assert clean.getpixel((PADDING + CELL_SIZE + CELL_SIZE // 2, PADDING + CELL_SIZE // 2)) == (
        255,
        255,
        255,
    )
    assert overlay.getpixel((15, 15)) != (255, 255, 255)
    assert overlay.getpixel((45, 15)) == (255, 255, 255)


def test_color_statistics_exclude_unwanted_cells() -> None:
    project = project_with_unwanted_cell()
    expected_one_color_stats_height = PADDING * 2 + STAT_LINE_HEIGHT * 2

    clean = render_clean_pattern(
        project,
        PaletteRepository.load_default(),
        include_color_stats=True,
    )
    overlay = render_overlay_pattern(
        project,
        Image.new("RGB", (60, 30), "white"),
        PaletteRepository.load_default(),
        include_color_stats=True,
    )

    assert clean.height == expected_one_color_stats_height
    assert overlay.height == expected_one_color_stats_height


def test_clean_export_can_hide_color_statistics() -> None:
    project = confirmed_project()
    with_stats = render_clean_pattern(
        project,
        PaletteRepository.load_default(),
        include_color_stats=True,
    )
    without_stats = render_clean_pattern(
        project,
        PaletteRepository.load_default(),
        include_color_stats=False,
    )

    assert with_stats.size[0] > without_stats.size[0]
    assert with_stats.size[1] > without_stats.size[1]
    assert without_stats.size == (
        PADDING * 2 + 2 * CELL_SIZE,
        PADDING * 2 + CELL_SIZE,
    )


def test_clean_export_matches_preview_cell_size_and_centers_labels() -> None:
    project = confirmed_project()
    clean = render_clean_pattern(
        project,
        PaletteRepository.load_default(),
        include_color_stats=False,
    )

    assert CELL_SIZE == 52

    def label_center(column: int, fill: tuple[int, int, int]) -> tuple[float, float]:
        left = PADDING + column * CELL_SIZE
        top = PADDING
        pixels = [
            (x, y)
            for x in range(left + 2, left + CELL_SIZE - 2)
            for y in range(top + 2, top + CELL_SIZE - 2)
            if clean.getpixel((x, y)) != fill
        ]
        assert pixels
        return (
            (min(x for x, _ in pixels) + max(x for x, _ in pixels)) / 2,
            (min(y for _, y in pixels) + max(y for _, y in pixels)) / 2,
        )

    first_label_center = label_center(0, (14, 14, 14))
    second_label_center = label_center(1, (247, 150, 157))
    expected_y = PADDING + CELL_SIZE / 2

    assert abs(first_label_center[0] - (PADDING + CELL_SIZE / 2)) <= 3
    assert abs(first_label_center[1] - expected_y) <= 3
    assert abs(second_label_center[0] - (PADDING + CELL_SIZE + CELL_SIZE / 2)) <= 3
    assert abs(second_label_center[1] - expected_y) <= 3


def test_overlay_export_can_append_color_statistics() -> None:
    project = confirmed_project()
    source = Image.new("RGB", (60, 30), "white")
    plain = render_overlay_pattern(project, source, PaletteRepository.load_default())
    with_stats = render_overlay_pattern(
        project,
        source,
        PaletteRepository.load_default(),
        include_color_stats=True,
    )

    assert with_stats.size[0] > plain.size[0]
    assert with_stats.size[1] >= plain.size[1]


def test_clean_export_uses_contrasting_stroked_labels() -> None:
    project = confirmed_project()
    project.cells[0].sampled_color = None
    project.cells[1].sampled_color = None
    clean = render_clean_pattern(project, PaletteRepository.load_default())

    dark_cell_pixels = [
        clean.getpixel((x, y))
        for x in range(PADDING, PADDING + CELL_SIZE)
        for y in range(PADDING, PADDING + CELL_SIZE)
    ]
    light_cell_pixels = [
        clean.getpixel((x, y))
        for x in range(PADDING + CELL_SIZE, PADDING + 2 * CELL_SIZE)
        for y in range(PADDING, PADDING + CELL_SIZE)
    ]

    assert any(max(pixel) >= 235 for pixel in dark_cell_pixels)
    assert any(max(pixel) <= 35 for pixel in dark_cell_pixels)
    assert any(max(pixel) <= 35 for pixel in light_cell_pixels)
    assert any(min(pixel) >= 235 for pixel in light_cell_pixels)


def test_beadproject_archive_reopens_with_source_image(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "original")
    project = confirmed_project()
    store.save(project)
    store.save_source_image(project.id, "source.png", b"source-bytes")

    archive = store.export_archive(project.id)
    restored_store = ProjectStore(tmp_path / "restored")
    restored = restored_store.import_archive(archive)

    assert restored.cells == project.cells
    assert (
        tmp_path / "restored" / project.id / "source.png"
    ).read_bytes() == b"source-bytes"


def test_beadproject_archive_preserves_unwanted_cells(tmp_path: Path) -> None:
    store = ProjectStore(tmp_path / "original")
    project = project_with_unwanted_cell()
    store.save(project)
    store.save_source_image(project.id, "source.png", b"source-bytes")

    archive = store.export_archive(project.id)
    restored_store = ProjectStore(tmp_path / "restored")
    restored = restored_store.import_archive(archive)

    unwanted = restored.cells[1]
    assert unwanted.status == CellStatus.empty
    assert unwanted.detected_source_code is None
    assert unwanted.confirmed_source_code is None
    assert unwanted.target_code is None
    assert unwanted.confidence == 0
    assert unwanted.ocr_candidates == []
    assert "user-marked-unwanted" in unwanted.issue_reasons


def test_beadproject_archive_rejects_unknown_format_version(tmp_path: Path) -> None:
    project = confirmed_project()
    project.format_version = 2
    archive = BytesIO()
    with ZipFile(archive, "w", ZIP_DEFLATED) as bundle:
        bundle.writestr("project.json", project.model_dump_json())

    store = ProjectStore(tmp_path)

    try:
        store.import_archive(archive.getvalue())
    except ValueError as exc:
        assert "format_version" in str(exc)
        return
    raise AssertionError("unsupported project archive must be rejected")


def test_export_endpoints_download_results(client, synthetic_png: bytes) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    csv_response = client.get(f"/api/projects/{created['id']}/exports/mapping.csv")
    png_response = client.get(f"/api/projects/{created['id']}/exports/clean.png")
    overlay_response = client.get(f"/api/projects/{created['id']}/exports/overlay.png")
    archive_response = client.get(
        f"/api/projects/{created['id']}/exports/project.beadproject"
    )

    assert csv_response.status_code == 200
    assert png_response.headers["content-type"] == "image/png"
    assert overlay_response.headers["content-type"] == "image/png"
    assert archive_response.status_code == 200

    png_without_stats = client.get(
        f"/api/projects/{created['id']}/exports/clean.png?include_color_stats=false"
    )
    assert png_without_stats.status_code == 200

    reopened_response = client.post(
        "/api/projects/open",
        files={
            "archive": (
                "project.beadproject",
                archive_response.content,
                "application/octet-stream",
            )
        },
    )
    assert reopened_response.status_code == 201
    assert reopened_response.json()["cells"] == created["cells"]


def test_export_warns_when_review_required_cells_remain(client) -> None:
    project = confirmed_project()
    project.cells[0].status = CellStatus.review_required
    client.app.state.store.save(project)
    client.app.state.store.save_source_image(project.id, "source.png", b"source")

    response = client.get(f"/api/projects/{project.id}/exports/mapping.csv")

    assert response.status_code == 200
    assert response.headers["X-Bead-Warnings"] == "1"


def test_export_warning_count_excludes_unwanted_cells(client) -> None:
    project = project_with_unwanted_cell()
    project.cells[0].status = CellStatus.review_required
    client.app.state.store.save(project)
    client.app.state.store.save_source_image(project.id, "source.png", b"source")

    response = client.get(f"/api/projects/{project.id}/exports/mapping.csv")

    assert response.status_code == 200
    assert response.headers["X-Bead-Warnings"] == "1"
