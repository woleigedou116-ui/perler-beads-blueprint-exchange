import type { BeadProject, PaletteMapping, RGB } from "../../domain/types";

export interface TargetColorStat {
  code: string;
  count: number;
  rgb: RGB | null;
}

export function buildTargetColorStats(
  project: BeadProject,
  paletteMappings: PaletteMapping[],
): TargetColorStat[] {
  const targetRgbByCode = new Map<string, RGB>();
  for (const mapping of paletteMappings) {
    if (mapping.target_code && mapping.target_rgb && !targetRgbByCode.has(mapping.target_code)) {
      targetRgbByCode.set(mapping.target_code, mapping.target_rgb);
    }
  }

  const counts = new Map<string, number>();
  const sampledRgbByCode = new Map<string, RGB>();
  for (const cell of project.cells) {
    if (!cell.target_code || cell.status === "empty") {
      continue;
    }
    counts.set(cell.target_code, (counts.get(cell.target_code) ?? 0) + 1);
    if (cell.sampled_color && !sampledRgbByCode.has(cell.target_code)) {
      sampledRgbByCode.set(cell.target_code, cell.sampled_color);
    }
  }

  return Array.from(counts.entries())
    .map(([code, count]) => ({
      code,
      count,
      rgb: targetRgbByCode.get(code) ?? sampledRgbByCode.get(code) ?? null,
    }))
    .sort((left, right) => left.code.localeCompare(right.code));
}
