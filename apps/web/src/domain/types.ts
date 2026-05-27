export type CellStatus = "confirmed" | "review-required" | "empty";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface OcrCandidate {
  text: string;
  normalized_code: string | null;
  confidence: number;
}

export interface Cell {
  row: number;
  column: number;
  sampled_color: RGB | null;
  ocr_candidates: OcrCandidate[];
  detected_source_code: string | null;
  confirmed_source_code: string | null;
  target_code: string | null;
  confidence: number;
  status: CellStatus;
  issue_reasons: string[];
}

export interface MappingDecision {
  source_code: string;
  target_code: string | null;
  origin: string;
  confidence: number;
}

export interface BeadProject {
  id: string;
  name: string;
  source_image_name: string;
  source_standard: "MARD";
  target_standard: "COCO";
  palette_version: string;
  grid: {
    rows: number;
    columns: number;
    bounds: number[];
    x_lines: number[];
    y_lines: number[];
  };
  mappings: MappingDecision[];
  cells: Cell[];
  export_history: string[];
  source_attribution: string | null;
}
