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
