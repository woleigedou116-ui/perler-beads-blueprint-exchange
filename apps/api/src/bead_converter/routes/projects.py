from io import BytesIO

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from PIL import Image, UnidentifiedImageError

from bead_converter.domain.models import BeadProject, CellStatus, MappingDecision
from bead_converter.vision.grid import GridNotFoundError
from bead_converter.vision.ocr import RapidOcrProvider
from bead_converter.vision.recognizer import recognize_pattern

router = APIRouter(prefix="/api/projects", tags=["projects"])
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


class MappingUpdate(BaseModel):
    target_code: str


class CellUpdate(BaseModel):
    source_code: str
    target_code: str


class AttributionUpdate(BaseModel):
    source_attribution: str


def _project(request: Request, project_id: str) -> BeadProject:
    try:
        return request.app.state.store.load(project_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="项目不存在") from exc


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


@router.get("/{project_id}", response_model=BeadProject)
def get_project(request: Request, project_id: str) -> BeadProject:
    return _project(request, project_id)


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
