from collections import Counter
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

from bead_converter.domain.models import BeadProject, Cell, CellStatus
from bead_converter.palettes.repository import PaletteRepository

CELL_SIZE = 52
PADDING = 24
LEGEND_WIDTH = 190
STAT_SWATCH = 22
STAT_LINE_HEIGHT = 30
LABEL_FONT_SIZE = 16
LABEL_STROKE_WIDTH = 2
REVIEW_COLOR = (226, 151, 32)
DARK_TEXT = (25, 25, 25)
LIGHT_TEXT = (255, 255, 255)


@lru_cache
def _cell_label_font() -> ImageFont.ImageFont:
    for font_name in (
        "DejaVuSans-Bold.ttf",
        "arialbd.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ):
        try:
            return ImageFont.truetype(font_name, LABEL_FONT_SIZE)
        except OSError:
            continue
    try:
        return ImageFont.load_default(size=LABEL_FONT_SIZE)
    except TypeError:
        return ImageFont.load_default()


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
    cell_box: tuple[int, int, int, int],
    text: str,
    fill: tuple[int, int, int] | str,
) -> None:
    text_fill, stroke_fill = _label_colors(fill)
    font = _cell_label_font()
    left, top, right, bottom = cell_box
    text_box = draw.textbbox(
        (0, 0),
        text,
        font=font,
        stroke_width=LABEL_STROKE_WIDTH,
    )
    text_width = text_box[2] - text_box[0]
    text_height = text_box[3] - text_box[1]
    position = (
        round(left + (right - left - text_width) / 2 - text_box[0]),
        round(top + (bottom - top - text_height) / 2 - text_box[1]),
    )
    draw.text(
        position,
        text,
        font=font,
        fill=text_fill,
        stroke_width=LABEL_STROKE_WIDTH,
        stroke_fill=stroke_fill,
    )


def _target_counts(project: BeadProject) -> Counter[str]:
    counts: Counter[str] = Counter()
    for cell in project.cells:
        if cell.target_code and cell.status != CellStatus.empty:
            counts[cell.target_code] += 1
    return counts


def _target_rgb(
    project: BeadProject,
    palette: PaletteRepository,
    target_code: str,
) -> tuple[int, int, int]:
    for cell in project.cells:
        if cell.target_code != target_code or cell.status == CellStatus.empty:
            continue
        fill = _target_fill(cell, palette)
        if fill != (245, 245, 245):
            return fill
    return (245, 245, 245)


def _stats_size(counts: Counter[str]) -> tuple[int, int]:
    if not counts:
        return 0, 0
    return LEGEND_WIDTH, PADDING * 2 + STAT_LINE_HEIGHT * (len(counts) + 1)


def _draw_color_stats(
    draw: ImageDraw.ImageDraw,
    project: BeadProject,
    palette: PaletteRepository,
    origin: tuple[int, int],
    counts: Counter[str],
) -> None:
    if not counts:
        return
    left, top = origin
    draw.text((left, top), "COCO 色块统计", fill=(20, 20, 20))
    for index, (target_code, count) in enumerate(sorted(counts.items()), start=1):
        row_top = top + index * STAT_LINE_HEIGHT
        fill = _target_rgb(project, palette, target_code)
        draw.rectangle(
            (left, row_top, left + STAT_SWATCH, row_top + STAT_SWATCH),
            fill=fill,
            outline=(120, 120, 120),
        )
        draw.text(
            (left + STAT_SWATCH + 8, row_top + 3),
            f"{target_code} x {count}",
            fill=(20, 20, 20),
        )


def _append_color_stats(
    image: Image.Image,
    project: BeadProject,
    palette: PaletteRepository,
) -> Image.Image:
    counts = _target_counts(project)
    stats_width, stats_height = _stats_size(counts)
    if stats_width == 0:
        return image
    output = Image.new(
        "RGB",
        (image.width + stats_width, max(image.height, stats_height)),
        "white",
    )
    output.paste(image, (0, 0))
    _draw_color_stats(
        ImageDraw.Draw(output),
        project,
        palette,
        (image.width + 16, PADDING),
        counts,
    )
    return output


def render_clean_pattern(
    project: BeadProject,
    palette: PaletteRepository,
    include_color_stats: bool = True,
) -> Image.Image:
    grid_width = project.grid.columns * CELL_SIZE
    grid_height = project.grid.rows * CELL_SIZE
    counts = _target_counts(project)
    legend_width = LEGEND_WIDTH if include_color_stats and counts else 0
    _, stats_height = _stats_size(counts) if include_color_stats else (0, 0)
    image = Image.new(
        "RGB",
        (
            PADDING * 2 + grid_width + legend_width,
            max(PADDING * 2 + grid_height, stats_height),
        ),
        "white",
    )
    draw = ImageDraw.Draw(image)

    for cell in project.cells:
        left = PADDING + cell.column * CELL_SIZE
        top = PADDING + cell.row * CELL_SIZE
        right = left + CELL_SIZE
        bottom = top + CELL_SIZE
        fill = "white" if cell.status == CellStatus.empty else _target_fill(cell, palette)
        draw.rectangle((left, top, right, bottom), fill=fill, outline=(155, 155, 155))
        if cell.target_code:
            _draw_cell_label(draw, (left, top, right, bottom), cell.target_code, fill)

    if include_color_stats:
        _draw_color_stats(
            draw,
            project,
            palette,
            (PADDING + grid_width + 22, PADDING),
            counts,
        )
    return image


def render_overlay_pattern(
    project: BeadProject,
    source_image: Image.Image,
    palette: PaletteRepository | None = None,
    include_color_stats: bool = False,
) -> Image.Image:
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
    result = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")
    if include_color_stats and palette is not None:
        return _append_color_stats(result, project, palette)
    return result
