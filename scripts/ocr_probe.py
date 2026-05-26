import argparse
from pathlib import Path

from PIL import Image, ImageStat

from bead_converter.vision.grid import GridNotFoundError, detect_grid
from bead_converter.vision.ocr import RapidOcrProvider


def candidate_codes() -> set[str]:
    groups = {
        "A": 32,
        "B": 32,
        "C": 32,
        "D": 26,
        "E": 24,
        "F": 25,
        "G": 21,
        "H": 23,
        "M": 15,
        "P": 23,
        "Q": 5,
        "R": 28,
        "Y": 5,
        "ZG": 8,
    }
    return {
        f"{prefix}{number}"
        for prefix, maximum in groups.items()
        for number in range(1, maximum + 1)
    }


def likely_has_code(cell: Image.Image) -> bool:
    grayscale = cell.convert("L")
    width, height = grayscale.size
    cropped = grayscale.crop(
        (max(1, width // 8), max(1, height // 8), width - width // 8, height - height // 8)
    )
    return ImageStat.Stat(cropped).rms[0] < 248 or cropped.getextrema()[0] < 170


def probe(path: Path, sample_limit: int) -> str:
    image = Image.open(path)
    try:
        grid = detect_grid(image)
    except GridNotFoundError:
        return f"{path.name} | grid-not-found"
    cells: list[Image.Image] = []
    for row in range(grid.rows):
        for column in range(grid.columns):
            crop = image.crop(
                (
                    grid.x_lines[column],
                    grid.y_lines[row],
                    grid.x_lines[column + 1],
                    grid.y_lines[row + 1],
                )
            )
            if likely_has_code(crop):
                cells.append(crop)
    if len(cells) > sample_limit:
        stride = max(1, len(cells) // sample_limit)
        cells = cells[::stride][:sample_limit]
    recognized = RapidOcrProvider().recognize_cells(cells, candidate_codes())
    hits = sum(any(item.normalized_code for item in candidates) for candidates in recognized)
    return (
        f"{path.name} | {grid.rows}x{grid.columns} | "
        f"sampled={len(cells)} | normalized-hits={hits}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("samples_dir", type=Path)
    parser.add_argument("--limit", type=int, default=30)
    args = parser.parse_args()
    for path in sorted(args.samples_dir.glob("*")):
        if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            print(probe(path, args.limit))


if __name__ == "__main__":
    main()
