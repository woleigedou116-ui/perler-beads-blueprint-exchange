from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from bead_converter.palettes.repository import PaletteRepository
from bead_converter.projects.store import ProjectStore
from bead_converter.routes.palettes import router as palettes_router
from bead_converter.routes.projects import router as projects_router
from bead_converter.settings import default_data_root, web_dist_path
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
    web_dist = web_dist_path()
    if web_dist.exists():
        application.mount("/", StaticFiles(directory=web_dist, html=True), name="web")
    else:
        @application.get("/", response_class=HTMLResponse)
        def web_not_built() -> str:
            return (
                "<!doctype html><html lang=\"zh-CN\"><title>拼豆图纸标准转换</title>"
                "<body><h1>拼豆图纸标准转换</h1>"
                "<p>请先在 apps/web 执行 npm run build，再重新启动本地服务。</p>"
                "</body></html>"
            )
    return application


app = create_app()
