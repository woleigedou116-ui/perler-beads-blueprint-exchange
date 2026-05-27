import type { BeadProject } from "../../domain/types";

export const projectWithOneReviewCell: BeadProject = {
  id: "pattern-1",
  name: "春日图纸",
  source_image_name: "pattern.png",
  source_standard: "MARD",
  target_standard: "COCO",
  palette_version: "mard-coco.v1",
  grid: {
    rows: 1,
    columns: 2,
    bounds: [0, 0, 64, 32],
    x_lines: [0, 32, 64],
    y_lines: [0, 32],
  },
  mappings: [],
  cells: [
    {
      row: 0,
      column: 0,
      sampled_color: { r: 14, g: 14, b: 14 },
      ocr_candidates: [],
      detected_source_code: "H7",
      confirmed_source_code: null,
      target_code: "B09",
      confidence: 0.6,
      status: "review-required",
      issue_reasons: ["color-only-suggestion"],
    },
    {
      row: 0,
      column: 1,
      sampled_color: { r: 247, g: 150, b: 157 },
      ocr_candidates: [],
      detected_source_code: "F14",
      confirmed_source_code: "F14",
      target_code: "K07",
      confidence: 1,
      status: "confirmed",
      issue_reasons: [],
    },
  ],
  export_history: [],
  source_attribution: null,
};

export const projectAfterMappingConfirmation: BeadProject = {
  ...projectWithOneReviewCell,
  cells: projectWithOneReviewCell.cells.map((cell) => ({
    ...cell,
    confirmed_source_code: cell.detected_source_code,
    status: "confirmed",
    issue_reasons: ["user-confirmed-mapping"],
  })),
};
