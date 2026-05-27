from PIL import Image, ImageDraw


def make_grid_pattern(rows: int, columns: int, cell_size: int = 32) -> Image.Image:
    margin = 8
    width = columns * cell_size + 2 * margin + 1
    height = rows * cell_size + 2 * margin + 1
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    for column in range(columns + 1):
        x = margin + column * cell_size
        draw.line((x, margin, x, height - margin - 1), fill=(25, 25, 25), width=1)
    for row in range(rows + 1):
        y = margin + row * cell_size
        draw.line((margin, y, width - margin - 1, y), fill=(25, 25, 25), width=1)
    return image


def make_plain_image() -> Image.Image:
    return Image.new("RGB", (160, 120), (241, 236, 232))


def make_colored_grid_pattern(
    rows: int,
    columns: int,
    cell_size: int = 32,
) -> Image.Image:
    margin = 8
    width = columns * cell_size + 2 * margin + 1
    height = rows * cell_size + 2 * margin + 1
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    colors = [(240, 204, 211), (90, 148, 193), (254, 244, 223), (57, 61, 66)]
    for row in range(rows):
        for column in range(columns):
            color = colors[(row + column) % len(colors)]
            left = margin + column * cell_size + 1
            top = margin + row * cell_size + 1
            draw.rectangle(
                (left, top, left + cell_size - 2, top + cell_size - 2),
                fill=color,
            )
    for column in range(columns + 1):
        x = margin + column * cell_size
        width_px = 3 if column % 5 == 0 else 1
        shade = (25, 25, 25) if width_px == 3 else (205, 205, 205)
        draw.line((x, margin, x, height - margin - 1), fill=shade, width=width_px)
    for row in range(rows + 1):
        y = margin + row * cell_size
        width_px = 3 if row % 5 == 0 else 1
        shade = (25, 25, 25) if width_px == 3 else (205, 205, 205)
        draw.line((margin, y, width - margin - 1, y), fill=shade, width=width_px)
    return image


def make_grid_with_missing_inner_line(
    rows: int,
    columns: int,
    cell_size: int = 32,
) -> Image.Image:
    image = make_grid_pattern(rows=rows, columns=columns, cell_size=cell_size)
    margin = 8
    missing_x = margin + 3 * cell_size
    draw = ImageDraw.Draw(image)
    draw.line(
        (missing_x, margin + 1, missing_x, image.height - margin - 2),
        fill="white",
        width=1,
    )
    return image


def make_sparse_vertical_grid(
    rows: int,
    columns: int,
    x_lines: list[int],
    y_spacing: int,
    retained_vertical_indices: set[int],
) -> Image.Image:
    margin = 8
    y_lines = [margin + row * y_spacing for row in range(rows + 1)]
    image = Image.new("RGB", (x_lines[-1] + margin + 1, y_lines[-1] + margin + 1), "white")
    draw = ImageDraw.Draw(image)
    for index in retained_vertical_indices:
        draw.line((x_lines[index], y_lines[0], x_lines[index], y_lines[-1]), fill=(25, 25, 25))
    for y in y_lines:
        draw.line((x_lines[0], y, x_lines[-1], y), fill=(25, 25, 25))
    return image


def make_rectangular_grid_with_trailing_legend_lines(
    rows: int,
    columns: int,
    cell_size: int,
) -> Image.Image:
    margin = 8
    width = columns * cell_size + 2 * margin + 1
    height = (rows + 11) * cell_size + 2 * margin + 1
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    bottom = margin + rows * cell_size
    for column in range(columns + 1):
        x = margin + column * cell_size
        draw.line((x, margin, x, bottom), fill=(25, 25, 25))
    for row in range(rows + 1):
        y = margin + row * cell_size
        draw.line((margin, y, width - margin - 1, y), fill=(25, 25, 25))
    for row in (rows + 4, rows + 10):
        y = margin + row * cell_size
        draw.line((margin, y, width - margin - 1, y), fill=(25, 25, 25))
    return image


def make_colored_cell_with_dark_code(
    fill: tuple[int, int, int],
    code: str,
    size: int = 48,
) -> Image.Image:
    image = Image.new("RGB", (size, size), fill)
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, size - 1, size - 1), outline=(20, 20, 20), width=2)
    draw.text((size // 4, size // 3), code, fill=(12, 12, 12))
    return image


def make_grid_with_cell_fill(
    fill: tuple[int, int, int],
    rows: int = 3,
    columns: int = 3,
    cell_size: int = 32,
    filled_cells: list[tuple[int, int]] | None = None,
) -> Image.Image:
    image = make_grid_pattern(rows=rows, columns=columns, cell_size=cell_size)
    margin = 8
    draw = ImageDraw.Draw(image)
    for row, column in filled_cells or [(0, 0)]:
        draw.rectangle(
            (
                margin + column * cell_size + 1,
                margin + row * cell_size + 1,
                margin + (column + 1) * cell_size - 1,
                margin + (row + 1) * cell_size - 1,
            ),
            fill=fill,
        )
    draw.line((margin, margin, margin + columns * cell_size, margin), fill=(25, 25, 25))
    draw.line((margin, margin, margin, margin + rows * cell_size), fill=(25, 25, 25))
    return image
