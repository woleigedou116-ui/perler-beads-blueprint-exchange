import type { BeadProject, PaletteMapping } from "../domain/types";

export interface PaletteResponse {
  version: string;
  mappings: PaletteMapping[];
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

export async function importImage(file: File): Promise<BeadProject> {
  const form = new FormData();
  form.append("image", file);
  form.append("target_standard", "COCO");
  return projectResponse(
    await fetch("/api/projects/import", { method: "POST", body: form }),
  );
}

export async function getPalette(): Promise<PaletteResponse> {
  const response = await fetch("/api/palettes/mard-coco");
  if (!response.ok) {
    throw new Error("色号表加载失败");
  }
  return response.json() as Promise<PaletteResponse>;
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
