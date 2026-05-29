import argparse
import csv
import json
from collections import Counter
from pathlib import Path
import shutil
from time import perf_counter
import sys

from PIL import Image, UnidentifiedImageError

from bead_converter.palettes.repository import PaletteRepository
from bead_converter.vision.grid import GridNotFoundError
from bead_converter.vision.ocr import OcrProvider, RapidOcrProvider, TesseractOcrProvider
from bead_converter.vision.recognizer import recognize_pattern

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
ENGINE_CHOICES = {"rapidocr", "tesseract"}


def safe_display_name(name: str, encoding: str | None = None) -> str:
    console_encoding = encoding or sys.stdout.encoding or "utf-8"
    return name.encode(console_encoding, errors="replace").decode(console_encoding)


def compact_counter(counter: Counter[str], limit: int | None = None) -> str:
    items = counter.most_common(limit)
    return "; ".join(f"{key}={value}" for key, value in items)


def top_review_groups(project) -> Counter[str]:
    groups: Counter[str] = Counter()
    for cell in project.cells:
        if cell.status != "review-required":
            continue
        source = cell.detected_source_code or "?"
        target = cell.target_code or "?"
        reasons = ",".join(sorted(cell.issue_reasons)) or "unknown"
        groups[f"{source}->{target} [{reasons}]"] += 1
    return groups


def raw_ocr_counter(project) -> Counter[str]:
    counter: Counter[str] = Counter()
    for cell in project.cells:
        for candidate in cell.ocr_candidates:
            normalized = candidate.normalized_code or "?"
            counter[f"{candidate.text}->{normalized}"] += 1
    return counter


def target_counter(project) -> Counter[str]:
    counter: Counter[str] = Counter()
    for cell in project.cells:
        if cell.target_code and cell.status != "empty":
            counter[cell.target_code] += 1
    return counter


def empty_row(path: Path, status: str) -> dict:
    return {
        "file": path.name,
        "engine": "",
        "status": status,
        "grid": "",
        "total_cells": 0,
        "confirmed": 0,
        "review_required": 0,
        "empty": 0,
        "elapsed_seconds": 0.0,
        "issue_counts": "",
        "top_review_groups": "",
        "top_raw_ocr": "",
        "top_targets": "",
    }


def benchmark_image(
    path: Path,
    palette: PaletteRepository,
    ocr: OcrProvider,
    engine: str,
) -> dict:
    start = perf_counter()
    row = empty_row(path, "ok")
    row["engine"] = engine
    try:
        image = Image.open(path).convert("RGB")
        project = recognize_pattern(image, path.name, palette, ocr)
    except GridNotFoundError:
        row["status"] = "grid-not-found"
        row["elapsed_seconds"] = round(perf_counter() - start, 3)
        return row
    except (UnidentifiedImageError, OSError) as exc:
        row["status"] = f"image-error:{exc.__class__.__name__}"
        row["elapsed_seconds"] = round(perf_counter() - start, 3)
        return row

    status_counts = Counter(cell.status.value for cell in project.cells)
    issue_counts = Counter(
        reason
        for cell in project.cells
        if cell.status == "review-required"
        for reason in cell.issue_reasons
    )
    row.update(
        {
            "grid": f"{project.grid.rows}x{project.grid.columns}",
            "total_cells": len(project.cells),
            "confirmed": status_counts["confirmed"],
            "review_required": status_counts["review-required"],
            "empty": status_counts["empty"],
            "elapsed_seconds": round(perf_counter() - start, 3),
            "issue_counts": compact_counter(issue_counts),
            "top_review_groups": compact_counter(top_review_groups(project), 8),
            "top_raw_ocr": compact_counter(raw_ocr_counter(project), 12),
            "top_targets": compact_counter(target_counter(project), 12),
        }
    )
    return row


def tesseract_available(command: str) -> bool:
    return Path(command).exists() or shutil.which(command) is not None


def create_provider(engine: str, tesseract_command: str) -> OcrProvider | None:
    if engine == "rapidocr":
        return RapidOcrProvider()
    if engine == "tesseract":
        if not tesseract_available(tesseract_command):
            return None
        return TesseractOcrProvider(command=tesseract_command)
    raise ValueError(f"Unsupported OCR engine: {engine}")


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_json(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("samples_dir", type=Path)
    parser.add_argument("--engine", choices=sorted(ENGINE_CHOICES), default="rapidocr")
    parser.add_argument("--tesseract-command", default="tesseract")
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
    )
    parser.add_argument(
        "--json-output",
        type=Path,
        default=None,
    )
    args = parser.parse_args()
    output = args.output or Path(".data") / "ocr-benchmark" / f"{args.engine}-summary.csv"
    json_output = (
        args.json_output
        or Path(".data") / "ocr-benchmark" / f"{args.engine}-summary.json"
    )

    image_paths = [
        path
        for path in sorted(args.samples_dir.iterdir(), key=lambda item: item.name)
        if path.suffix.lower() in IMAGE_SUFFIXES
    ]
    if not image_paths:
        raise SystemExit(f"No image files found in {args.samples_dir}")

    palette = PaletteRepository.load_default()
    ocr = create_provider(args.engine, args.tesseract_command)
    if ocr is None:
        rows = []
        for path in image_paths:
            row = empty_row(path, f"engine-unavailable:{args.engine}")
            row["engine"] = args.engine
            rows.append(row)
            print(
                safe_display_name(path.name),
                "|",
                row["status"],
                "| install Tesseract or pass --tesseract-command",
            )
        write_csv(output, rows)
        write_json(json_output, rows)
        print(f"CSV: {output}")
        print(f"JSON: {json_output}")
        return

    rows = []
    for path in image_paths:
        row = benchmark_image(path, palette, ocr, args.engine)
        rows.append(row)
        print(
            safe_display_name(path.name),
            "|",
            row["status"],
            "| grid",
            row["grid"] or "-",
            "| review",
            row["review_required"],
            "|",
            row["elapsed_seconds"],
            "s",
        )

    write_csv(output, rows)
    write_json(json_output, rows)
    print(f"CSV: {output}")
    print(f"JSON: {json_output}")


if __name__ == "__main__":
    main()
