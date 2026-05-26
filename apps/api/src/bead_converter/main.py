from pathlib import Path

from fastapi import FastAPI

from bead_converter.palettes.repository import PaletteRepository
from bead_converter.projects.store import ProjectStore
from bead_converter.routes.palettes import router as palettes_router
from bead_converter.routes.projects import router as projects_router
from bead_converter.settings import default_data_root
from bead_converter.vision.ocr import OcrProvider


def create_app(
    data_root: Path | None = None,
    ocr_provider: OcrProvider | None = None,
) -> FastAPI:
    application = FastAPI(title="拼豆图纸标准转换")
    application.state.store = ProjectStore(data_root or default_data_root())
    application.state.palette = PaletteRepository.load_default()
    application.state.ocr = ocr_provider

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "mode": "local"}

    application.include_router(palettes_router)
    application.include_router(projects_router)
    return application


app = create_app()
