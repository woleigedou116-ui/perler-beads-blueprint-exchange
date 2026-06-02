import type {
  BeadProject,
  MarkCellUnwantedRequest,
  MarkRegionUnwantedRequest,
  PaletteMapping,
  RGB,
} from "../domain/types";

export interface PaletteResponse {
  version: string;
  mappings: PaletteMapping[];
}

export interface ImportTiming {
  totalMs: number;
  readMs: number;
  decodeMs: number;
  ocrInitMs: number;
  recognizeMs: number;
  ocrMs?: number;
  ocrReps?: number;
  ocrEngineCalls?: number;
  ocrEngineMaxMs?: number;
  saveMs: number;
}

export interface ImportImageResult {
  project: BeadProject;
  timing: ImportTiming | null;
}

type RawRGB = RGB | [number, number, number] | null;

interface RawPaletteMapping {
  source_code: string;
  source_rgb: RawRGB;
  target_code: string | null;
  target_rgb: RawRGB;
  requires_review: boolean;
}

interface RawPaletteResponse {
  version: string;
  mappings: RawPaletteMapping[];
}

function normalizeRgb(rgb: RawRGB): RGB | null {
  if (!rgb) {
    return null;
  }
  if (Array.isArray(rgb)) {
    const [r, g, b] = rgb;
    return { r, g, b };
  }
  return rgb;
}

function normalizePaletteResponse(response: RawPaletteResponse): PaletteResponse {
  return {
    version: response.version,
    mappings: response.mappings.map((mapping) => ({
      source_code: mapping.source_code,
      source_rgb: normalizeRgb(mapping.source_rgb),
      target_code: mapping.target_code,
      target_rgb: normalizeRgb(mapping.target_rgb),
      requires_review: mapping.requires_review,
    })),
  };
}

async function projectResponse(response: Response): Promise<BeadProject> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      detail?: string;
    } | null;
    throw new Error(body?.detail ?? "请求失败，请稍后重试");
  }
  return response.json() as Promise<BeadProject>;
}

function parseImportTiming(header: string | null): ImportTiming | null {
  if (!header) {
    return null;
  }
  const values = Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim().split("="))
      .filter((parts): parts is [string, string] => parts.length === 2)
      .map(([key, value]) => [key, Number(value)]),
  );
  if (!Number.isFinite(values.total_ms) || !Number.isFinite(values.recognize_ms)) {
    return null;
  }
  return {
    totalMs: values.total_ms,
    readMs: Number.isFinite(values.read_ms) ? values.read_ms : 0,
    decodeMs: Number.isFinite(values.decode_ms) ? values.decode_ms : 0,
    ocrInitMs: Number.isFinite(values.ocr_init_ms) ? values.ocr_init_ms : 0,
    recognizeMs: values.recognize_ms,
    ocrMs: Number.isFinite(values.ocr_ms) ? values.ocr_ms : undefined,
    ocrReps: Number.isFinite(values.ocr_reps) ? values.ocr_reps : undefined,
    ocrEngineCalls: Number.isFinite(values.ocr_engine_calls)
      ? values.ocr_engine_calls
      : undefined,
    ocrEngineMaxMs: Number.isFinite(values.ocr_engine_max_ms)
      ? values.ocr_engine_max_ms
      : undefined,
    saveMs: Number.isFinite(values.save_ms) ? values.save_ms : 0,
  };
}

export async function importImage(file: File): Promise<ImportImageResult> {
  const form = new FormData();
  form.append("image", file);
  form.append("target_standard", "COCO");
  const response = await fetch("/api/projects/import", { method: "POST", body: form });
  return {
    project: await projectResponse(response),
    timing: parseImportTiming(response.headers.get("X-Bead-Timing")),
  };
}

export async function getPalette(): Promise<PaletteResponse> {
  const response = await fetch("/api/palettes/mard-coco");
  if (!response.ok) {
    throw new Error("色号表加载失败");
  }
  return normalizePaletteResponse((await response.json()) as RawPaletteResponse);
}

export async function openProject(file: File): Promise<BeadProject> {
  const form = new FormData();
  form.append("archive", file);
  return projectResponse(
    await fetch("/api/projects/open", { method: "POST", body: form }),
  );
}

export async function confirmMapping(
  projectId: string,
  sourceCode: string,
  targetCode: string,
): Promise<BeadProject> {
  return projectResponse(
    await fetch(`/api/projects/${projectId}/mappings/${sourceCode}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_code: targetCode }),
    }),
  );
}

export async function correctCell(
  projectId: string,
  row: number,
  column: number,
  sourceCode: string,
  targetCode: string,
): Promise<BeadProject> {
  return projectResponse(
    await fetch(`/api/projects/${projectId}/cells/${row}/${column}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_code: sourceCode, target_code: targetCode }),
    }),
  );
}

export async function correctReviewGroup(
  projectId: string,
  row: number,
  column: number,
  sourceCode: string,
  targetCode: string,
): Promise<BeadProject> {
  return projectResponse(
    await fetch(`/api/projects/${projectId}/cells/group`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row,
        column,
        source_code: sourceCode,
        target_code: targetCode,
      }),
    }),
  );
}

export async function markCellUnwanted(
  projectId: string,
  row: number,
  column: number,
): Promise<BeadProject> {
  const payload: MarkCellUnwantedRequest = { row, column };
  return projectResponse(
    await fetch(`/api/projects/${projectId}/cells/unwanted`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function markRegionUnwanted(
  projectId: string,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
): Promise<BeadProject> {
  const payload: MarkRegionUnwantedRequest = {
    start_row: startRow,
    start_column: startColumn,
    end_row: endRow,
    end_column: endColumn,
  };
  return projectResponse(
    await fetch(`/api/projects/${projectId}/cells/unwanted`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

export async function saveAttribution(
  projectId: string,
  sourceAttribution: string,
): Promise<BeadProject> {
  return projectResponse(
    await fetch(`/api/projects/${projectId}/source-attribution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_attribution: sourceAttribution }),
    }),
  );
}

export function exportUrl(
  projectId: string,
  kind: "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject",
  options: { includeColorStats?: boolean } = {},
): string {
  const params = new URLSearchParams();
  if (
    (kind === "clean.png" || kind === "overlay.png") &&
    options.includeColorStats !== undefined
  ) {
    params.set("include_color_stats", String(options.includeColorStats));
  }
  const query = params.toString();
  return `/api/projects/${projectId}/exports/${kind}${query ? `?${query}` : ""}`;
}

export function projectSourceImageUrl(projectId: string): string {
  return `/api/projects/${projectId}/source-image`;
}
