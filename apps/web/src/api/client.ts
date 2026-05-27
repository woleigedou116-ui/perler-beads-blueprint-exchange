import type { BeadProject } from "../domain/types";

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
): string {
  return `/api/projects/${projectId}/exports/${kind}`;
}
