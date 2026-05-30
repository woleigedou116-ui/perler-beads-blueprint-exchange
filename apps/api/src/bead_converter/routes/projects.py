from io import BytesIO

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

from bead_converter.domain.models import BeadProject, CellStatus, MappingDecision
from bead_converter.exports.csv_export import export_mapping_csv
from bead_converter.exports.image_export import render_clean_pattern, render_overlay_pattern
from bead_converter.vision.grid import GridNotFoundError
from bead_converter.vision.ocr import RapidOcrProvider
from bead_converter.vision.recognizer import recognize_pattern

router = APIRouter(prefix="/api/projects", tags=["projects"])
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
SOURCE_IMAGE_MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


class MappingUpdate(BaseModel):
    target_code: str


class CellUpdate(BaseModel):
    source_code: str
    target_code: str


class UnwantedCellsUpdate(BaseModel):
    row: int | None = None
    column: int | None = None
    start_row: int | None = None
    start_column: int | None = None
    end_row: int | None = None
    end_column: int | None = None


class AttributionUpdate(BaseModel):
    source_attribution: str


def _project(request: Request, project_id: str) -> BeadProject:
    try:
        return request.app.state.store.load(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="项目不存在") from exc


def _export_response(
    request: Request,
    project: BeadProject,
    content: bytes,
    media_type: str,
    filename: str,
) -> Response:
    unresolved = sum(
        cell.status == CellStatus.review_required for cell in project.cells
    )
    project.export_history.append(filename)
    request.app.state.store.save(project)
    return Response(
        content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Bead-Warnings": str(unresolved),
        },
    )


def _unwanted_bounds(update: UnwantedCellsUpdate) -> tuple[int, int, int, int]:
    single_cell_fields = (update.row, update.column)
    range_fields = (
        update.start_row,
        update.start_column,
        update.end_row,
        update.end_column,
    )
    if all(value is not None for value in single_cell_fields) and all(
        value is None for value in range_fields
    ):
        row = update.row
        column = update.column
        assert row is not None and column is not None
        return row, column, row, column
    if all(value is not None for value in range_fields) and all(
        value is None for value in single_cell_fields
    ):
        start_row = update.start_row
        start_column = update.start_column
        end_row = update.end_row
        end_column = update.end_column
        assert (
            start_row is not None
            and start_column is not None
            and end_row is not None
            and end_column is not None
        )
        if start_row > end_row or start_column > end_column:
            raise HTTPException(status_code=422, detail="无效的格子范围")
        return start_row, start_column, end_row, end_column
    raise HTTPException(status_code=422, detail="请提供单个格子或矩形范围")


@router.post("/import", response_model=BeadProject, status_code=status.HTTP_201_CREATED)
async def import_project(
    request: Request,
    image: UploadFile = File(...),
    project_name: str = Form("新图纸"),
    source_standard: str = Form("MARD"),
    target_standard: str = Form("COCO"),
) -> BeadProject:
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=422, detail="仅支持 JPG、PNG 或 WebP 图片")
    if source_standard != "MARD" or target_standard != "COCO":
        raise HTTPException(status_code=422, detail="首版仅支持 MARD 转 COCO")
    data = await image.read()
    try:
        source_image = Image.open(BytesIO(data)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=422, detail="无法读取上传图片") from exc
    if request.app.state.ocr is None:
        request.app.state.ocr = RapidOcrProvider()
    try:
        project = recognize_pattern(
            source_image,
            project_name,
            request.app.state.palette,
            request.app.state.ocr,
            source_standard,
            target_standard,
        )
    except GridNotFoundError as exc:
        raise HTTPException(status_code=422, detail="未检测到规则网格，请选择清晰网格图") from exc
    project.source_image_name = image.filename or "source-image"
    request.app.state.store.save_source_image(project.id, image.filename or "source.png", data)
    request.app.state.store.save(project)
    return project


@router.post("/open", response_model=BeadProject, status_code=status.HTTP_201_CREATED)
async def open_project(request: Request, archive: UploadFile = File(...)) -> BeadProject:
    try:
        return request.app.state.store.import_archive(await archive.read())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="无法打开项目文件") from exc


@router.get("/{project_id}", response_model=BeadProject)
def get_project(request: Request, project_id: str) -> BeadProject:
    return _project(request, project_id)


@router.get("/{project_id}/source-image")
def get_source_image(request: Request, project_id: str) -> Response:
    try:
        source_image = request.app.state.store.source_image_path(project_id)
        content = source_image.read_bytes()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="原始图片不存在") from exc
    return Response(
        content,
        media_type=SOURCE_IMAGE_MEDIA_TYPES.get(
            source_image.suffix.lower(),
            "application/octet-stream",
        ),
    )


@router.patch("/{project_id}/mappings/{source_code}", response_model=BeadProject)
def confirm_mapping(
    request: Request,
    project_id: str,
    source_code: str,
    update: MappingUpdate,
) -> BeadProject:
    project = _project(request, project_id)
    project.mappings = [
        decision for decision in project.mappings if decision.source_code != source_code
    ]
    project.mappings.append(
        MappingDecision(
            source_code=source_code,
            target_code=update.target_code,
            origin="user-confirmed",
            confidence=1.0,
        )
    )
    for cell in project.cells:
        if cell.confirmed_source_code == source_code or cell.detected_source_code == source_code:
            cell.confirmed_source_code = source_code
            cell.target_code = update.target_code
            cell.status = CellStatus.confirmed
            if "user-confirmed-mapping" not in cell.issue_reasons:
                cell.issue_reasons.append("user-confirmed-mapping")
    request.app.state.store.save(project)
    return project


@router.patch("/{project_id}/cells/unwanted", response_model=BeadProject)
def mark_unwanted_cells(
    request: Request,
    project_id: str,
    update: UnwantedCellsUpdate,
) -> BeadProject:
    project = _project(request, project_id)
    start_row, start_column, end_row, end_column = _unwanted_bounds(update)
    if (
        start_row < 0
        or start_column < 0
        or end_row >= project.grid.rows
        or end_column >= project.grid.columns
    ):
        raise HTTPException(status_code=422, detail="格子范围超出图纸")

    cells_by_position = {(cell.row, cell.column): cell for cell in project.cells}
    selected_positions = [
        (row, column)
        for row in range(start_row, end_row + 1)
        for column in range(start_column, end_column + 1)
    ]
    if any(position not in cells_by_position for position in selected_positions):
        raise HTTPException(status_code=404, detail="格子不存在")

    for position in selected_positions:
        cell = cells_by_position[position]
        cell.status = CellStatus.empty
        cell.detected_source_code = None
        cell.confirmed_source_code = None
        cell.target_code = None
        cell.confidence = 0
        cell.ocr_candidates = []
        if "user-marked-unwanted" not in cell.issue_reasons:
            cell.issue_reasons.append("user-marked-unwanted")
    request.app.state.store.save(project)
    return project


@router.patch("/{project_id}/cells/{row}/{column}", response_model=BeadProject)
def correct_cell(
    request: Request,
    project_id: str,
    row: int,
    column: int,
    update: CellUpdate,
) -> BeadProject:
    project = _project(request, project_id)
    try:
        cell = next(
            cell for cell in project.cells if cell.row == row and cell.column == column
        )
    except StopIteration as exc:
        raise HTTPException(status_code=404, detail="格子不存在") from exc
    cell.confirmed_source_code = update.source_code
    cell.target_code = update.target_code
    cell.status = CellStatus.confirmed
    if "user-corrected" not in cell.issue_reasons:
        cell.issue_reasons.append("user-corrected")
    request.app.state.store.save(project)
    return project


@router.post("/{project_id}/source-attribution", response_model=BeadProject)
def set_source_attribution(
    request: Request,
    project_id: str,
    update: AttributionUpdate,
) -> BeadProject:
    project = _project(request, project_id)
    project.source_attribution = update.source_attribution
    request.app.state.store.save(project)
    return project


@router.get("/{project_id}/exports/mapping.csv")
def export_csv(request: Request, project_id: str) -> Response:
    project = _project(request, project_id)
    return _export_response(
        request,
        project,
        export_mapping_csv(project),
        "text/csv; charset=utf-8",
        "mapping.csv",
    )


@router.get("/{project_id}/exports/clean.png")
def export_clean_image(
    request: Request,
    project_id: str,
    include_color_stats: bool = True,
) -> Response:
    project = _project(request, project_id)
    output = BytesIO()
    render_clean_pattern(
        project,
        request.app.state.palette,
        include_color_stats=include_color_stats,
    ).save(output, format="PNG")
    return _export_response(
        request,
        project,
        output.getvalue(),
        "image/png",
        "clean.png",
    )


@router.get("/{project_id}/exports/overlay.png")
def export_overlay_image(
    request: Request,
    project_id: str,
    include_color_stats: bool = True,
) -> Response:
    project = _project(request, project_id)
    try:
        source = Image.open(request.app.state.store.source_image_path(project_id))
    except (FileNotFoundError, UnidentifiedImageError) as exc:
        raise HTTPException(status_code=404, detail="原始图片不存在") from exc
    output = BytesIO()
    render_overlay_pattern(
        project,
        source,
        request.app.state.palette,
        include_color_stats=include_color_stats,
    ).save(output, format="PNG")
    return _export_response(
        request,
        project,
        output.getvalue(),
        "image/png",
        "overlay.png",
    )


@router.get("/{project_id}/exports/project.beadproject")
def export_archive(request: Request, project_id: str) -> Response:
    project = _project(request, project_id)
    try:
        data = request.app.state.store.export_archive(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="原始图片不存在") from exc
    return _export_response(
        request,
        project,
        data,
        "application/zip",
        "project.beadproject",
    )
