import { expect, it } from "vitest";

import type { BeadProject } from "../../domain/types";
import { visibleCellBoundsForPreview } from "./previewVirtualization";

function largeProject(): BeadProject {
  return {
    id: "large-pattern",
    name: "Large pattern",
    source_image_name: "large.png",
    source_standard: "MARD",
    target_standard: "COCO",
    palette_version: "mard-coco.v1",
    grid: {
      rows: 100,
      columns: 100,
      bounds: [0, 0, 1000, 1000],
      x_lines: Array.from({ length: 101 }, (_, index) => index * 10),
      y_lines: Array.from({ length: 101 }, (_, index) => index * 10),
    },
    mappings: [],
    cells: Array.from({ length: 10_000 }, (_, index) => ({
      row: Math.floor(index / 100),
      column: index % 100,
      sampled_color: { r: 200, g: 200, b: 200 },
      ocr_candidates: [],
      detected_source_code: "A1",
      confirmed_source_code: "A1",
      target_code: "T1",
      confidence: 1,
      status: "confirmed" as const,
      issue_reasons: [],
    })),
    export_history: [],
    source_attribution: null,
  };
}

it("calculates a buffered visible target-cell range from pan and zoom", () => {
  const bounds = visibleCellBoundsForPreview({
    contentSize: { width: 5200, height: 5200 },
    project: largeProject(),
    side: "target",
    sourceImageSize: null,
    transform: { zoom: 4, panX: -1040, panY: -1560 },
    viewportSize: { width: 520, height: 520 },
  });

  expect(bounds).toEqual({
    startRow: 60,
    startColumn: 25,
    endRow: 99,
    endColumn: 99,
  });
});

it("keeps the full fitted target grid visible at reset zoom", () => {
  const bounds = visibleCellBoundsForPreview({
    contentSize: { width: 5200, height: 5200 },
    project: largeProject(),
    side: "target",
    sourceImageSize: null,
    transform: { zoom: 1, panX: 0, panY: 0 },
    viewportSize: { width: 520, height: 520 },
  });

  expect(bounds).toEqual({
    startRow: 0,
    startColumn: 0,
    endRow: 99,
    endColumn: 99,
  });
});

it("calculates a buffered visible source-cell range in original image coordinates", () => {
  const bounds = visibleCellBoundsForPreview({
    contentSize: { width: 500, height: 500 },
    project: largeProject(),
    side: "source",
    sourceImageSize: { width: 1000, height: 1000 },
    transform: { zoom: 5, panX: -1000, panY: -1250 },
    viewportSize: { width: 500, height: 500 },
  });

  expect(bounds).toEqual({
    startRow: 30,
    startColumn: 19,
    endRow: 95,
    endColumn: 84,
  });
});

it("keeps the full fitted source grid visible at reset zoom", () => {
  const bounds = visibleCellBoundsForPreview({
    contentSize: { width: 1000, height: 1000 },
    project: largeProject(),
    side: "source",
    sourceImageSize: { width: 1000, height: 1000 },
    transform: { zoom: 1, panX: 0, panY: 0 },
    viewportSize: { width: 500, height: 500 },
  });

  expect(bounds).toEqual({
    startRow: 0,
    startColumn: 0,
    endRow: 99,
    endColumn: 99,
  });
});
