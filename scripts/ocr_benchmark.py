import argparse
import csv
import json
from collections import Counter
from pathlib import Path
import shutil
from time import perf_counter
import sys

from PIL import Image, ImageEnhance, ImageFilter, ImageOps, UnidentifiedImageError

from bead_converter.palettes.repository import PaletteRepository
from bead_converter.vision.grid import GridNotFoundError
from bead_converter.vision.ocr import OcrProvider, RapidOcrProvider, TesseractOcrProvider
from bead_converter.vision.recognizer import recognize_pattern

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
ENGINE_CHOICES = {"rapidocr", "tesseract"}
OCR_PROFILE_CHOICES = {"standard", "watermark"}
PREPROCESS_SCOPE_CHOICES = {"full", "ocr"}
PREPROCESS_CHOICES = {
    "none",
    "autocontrast",
    "sharpen",
    "contrast-sharpen",
    "grayscale-contrast",
}


def safe_display_name(name: str, encoding: str | None = None) -> str:
    console_encoding = encoding or sys.stdout.encoding or "utf-8"
    return name.encode(console_encoding, errors="replace").decode(console_encoding)


def compact_counter(counter: Counter[str], limit: int | None = None) -> str:
    items = counter.most_common(limit)
    return "; ".join(f"{key}={value}" for key, value in items)


def filter_image_paths(samples_dir: Path, name_contains: str | None = None) -> list[Path]:
    image_paths = [
        path
        for path in sorted(samples_dir.iterdir(), key=lambda item: item.name)
        if path.suffix.lower() in IMAGE_SUFFIXES
    ]
    if name_contains:
        image_paths = [path for path in image_paths if name_contains in path.name]
    return image_paths


def preprocess_image(image: Image.Image, mode: str) -> Image.Image:
    rgb_image = image.convert("RGB")
    if mode == "none":
        return rgb_image
    if mode == "autocontrast":
        return ImageOps.autocontrast(rgb_image)
    if mode == "sharpen":
        return rgb_image.filter(
            ImageFilter.UnsharpMask(radius=1.2, percent=170, threshold=3)
        )
    if mode == "contrast-sharpen":
        enhanced = ImageEnhance.Contrast(ImageOps.autocontrast(rgb_image)).enhance(1.22)
        return enhanced.filter(
            ImageFilter.UnsharpMask(radius=1.2, percent=170, threshold=3)
        )
    if mode == "grayscale-contrast":
        gray = ImageOps.autocontrast(ImageOps.grayscale(rgb_image))
        return ImageOps.colorize(gray, black="#000000", white="#ffffff").convert("RGB")
    raise ValueError(f"Unsupported preprocess mode: {mode}")


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


def empty_row(
    path: Path,
    status: str,
    preprocess: str = "none",
    preprocess_scope: str = "ocr",
    ocr_profile: str = "standard",
) -> dict:
    return {
        "file": path.name,
        "engine": "",
        "preprocess": preprocess,
        "preprocess_scope": preprocess_scope,
        "ocr_profile": ocr_profile,
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
    preprocess: str,
    preprocess_scope: str,
    ocr_profile: str,
) -> dict:
    start = perf_counter()
    row = empty_row(path, "ok", preprocess, preprocess_scope, ocr_profile)
    row["engine"] = engine
    try:
        image = Image.open(path).convert("RGB")
        processed_image = preprocess_image(image, preprocess)
        if preprocess_scope == "full":
            project = recognize_pattern(processed_image, path.name, palette, ocr)
        else:
            ocr_image = processed_image if preprocess != "none" else None
            project = recognize_pattern(
                image,
                path.name,
                palette,
                ocr,
                ocr_image=ocr_image,
            )
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


def create_provider(
    engine: str,
    tesseract_command: str,
    ocr_profile: str,
) -> OcrProvider | None:
    if engine == "rapidocr":
        return RapidOcrProvider(profile=ocr_profile)
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
    parser.add_argument(
        "--ocr-profile",
        choices=sorted(OCR_PROFILE_CHOICES),
        default="standard",
        help="Use the standard OCR pass or slower watermark-oriented cell variants.",
    )
    parser.add_argument("--tesseract-command", default="tesseract")
    parser.add_argument(
        "--preprocess",
        choices=sorted(PREPROCESS_CHOICES),
        default="none",
        help="Apply a benchmark-only preprocessing strategy before recognition.",
    )
    parser.add_argument(
        "--preprocess-scope",
        choices=sorted(PREPROCESS_SCOPE_CHOICES),
        default="ocr",
        help="Apply preprocessing to OCR crops only, or to the full image pipeline.",
    )
    parser.add_argument(
        "--name-contains",
        default=None,
        help="Only benchmark image files whose filename contains this text.",
    )
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
    suffix_parts = []
    if args.preprocess != "none":
        suffix_parts.append(f"{args.preprocess}-{args.preprocess_scope}")
    if args.ocr_profile != "standard":
        suffix_parts.append(args.ocr_profile)
    suffix = "" if not suffix_parts else "-" + "-".join(suffix_parts)
    output_name = f"{args.engine}{suffix}-summary.csv"
    json_name = f"{args.engine}{suffix}-summary.json"
    output = args.output or Path(".data") / "ocr-benchmark" / output_name
    json_output = args.json_output or Path(".data") / "ocr-benchmark" / json_name

    image_paths = filter_image_paths(args.samples_dir, args.name_contains)
    if not image_paths:
        raise SystemExit(f"No matching image files found in {args.samples_dir}")

    palette = PaletteRepository.load_default()
    ocr = create_provider(args.engine, args.tesseract_command, args.ocr_profile)
    if ocr is None:
        rows = []
        for path in image_paths:
            row = empty_row(
                path,
                f"engine-unavailable:{args.engine}",
                args.preprocess,
                args.preprocess_scope,
                args.ocr_profile,
            )
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
        row = benchmark_image(
            path,
            palette,
            ocr,
            args.engine,
            args.preprocess,
            args.preprocess_scope,
            args.ocr_profile,
        )
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
