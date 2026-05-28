from collections import Counter

from PIL import Image, ImageDraw

from bead_converter.domain.models import BeadProject, Cell, CellStatus
from bead_converter.palettes.repository import PaletteRepository

CELL_SIZE = 44
PADDING = 24
LEGEND_WIDTH = 180
REVIEW_COLOR = (226, 151, 32)
DARK_TEXT = (25, 25, 25)
LIGHT_TEXT = (255, 255, 255)


def _target_fill(cell: Cell, palette: PaletteRepository) -> tuple[int, int, int]:
    source_code = cell.confirmed_source_code or cell.detected_source_code
    if source_code:
        converted = palette.convert(source_code, "MARD", "COCO")
        if converted.target_code == cell.target_code and converted.target_rgb:
            return converted.target_rgb
    if cell.sampled_color:
        return (cell.sampled_color.r, cell.sampled_color.g, cell.sampled_color.b)
    return (245, 245, 245)


def _perceived_brightness(rgb: tuple[int, int, int]) -> float:
    red, green, blue = rgb
    return (red * 299 + green * 587 + blue * 114) / 1000


def _label_colors(fill: tuple[int, int, int] | str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    if fill == "white":
        return DARK_TEXT, LIGHT_TEXT
    return (
        (LIGHT_TEXT, DARK_TEXT)
        if _perceived_brightness(fill) < 145
        else (DARK_TEXT, LIGHT_TEXT)
    )


def _draw_cell_label(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    fill: tuple[int, int, int] | str,
) -> None:
    text_fill, stroke_fill = _label_colors(fill)
    draw.text(
        position,
        text,
        fill=text_fill,
        stroke_width=2,
        stroke_fill=stroke_fill,
    )


def render_clean_pattern(project: BeadProject, palette: PaletteRepository) -> Image.Image:
    grid_width = project.grid.columns * CELL_SIZE
    grid_height = project.grid.rows * CELL_SIZE
    image = Image.new(
        "RGB",
        (PADDING * 2 + grid_width + LEGEND_WIDTH, PADDING * 2 + grid_height),
        "white",
    )
    draw = ImageDraw.Draw(image)
    counts: Counter[str] = Counter()

    for cell in project.cells:
        left = PADDING + cell.column * CELL_SIZE
        top = PADDING + cell.row * CELL_SIZE
        right = left + CELL_SIZE
        bottom = top + CELL_SIZE
        fill = "white" if cell.status == CellStatus.empty else _target_fill(cell, palette)
        draw.rectangle((left, top, right, bottom), fill=fill, outline=(155, 155, 155))
        if cell.target_code:
            counts[cell.target_code] += 1
            _draw_cell_label(draw, (left + 8, top + 16), cell.target_code, fill)

    legend_x = PADDING + grid_width + 22
    draw.text((legend_x, PADDING), "COCO", fill=(20, 20, 20))
    for index, (target_code, count) in enumerate(sorted(counts.items()), start=1):
        draw.text(
            (legend_x, PADDING + index * 22),
            f"{target_code}: {count}",
            fill=(20, 20, 20),
        )
    return image


def render_overlay_pattern(project: BeadProject, source_image: Image.Image) -> Image.Image:
    image = source_image.convert("RGB").copy()
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for cell in project.cells:
        if cell.status != CellStatus.review_required:
            continue
        left = project.grid.x_lines[cell.column]
        top = project.grid.y_lines[cell.row]
        right = project.grid.x_lines[cell.column + 1]
        bottom = project.grid.y_lines[cell.row + 1]
        draw.rectangle(
            (left, top, right, bottom),
            fill=(*REVIEW_COLOR, 60),
            outline=(*REVIEW_COLOR, 255),
            width=3,
        )
    return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
