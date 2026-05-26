from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/palettes", tags=["palettes"])


@router.get("/mard-coco")
def get_mard_coco_palette(request: Request) -> dict[str, object]:
    palette = request.app.state.palette
    return {
        "version": palette.version,
        "mappings": [
            {
                "source_code": mapping.source_code,
                "source_rgb": mapping.source_rgb,
                "target_code": mapping.target_code,
                "target_rgb": mapping.target_rgb,
                "requires_review": mapping.requires_review,
            }
            for mapping in palette.all_mappings()
        ],
    }
