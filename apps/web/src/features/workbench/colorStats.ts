import type { BeadProject, PaletteMapping, RGB } from "../../domain/types";

export interface TargetColorStat {
  code: string;
  count: number;
  rgb: RGB | null;
}

export interface ColorStatSort {
  sortBy: "code" | "count";
  sortDirection: "asc" | "desc";
}

const DEFAULT_SORT: ColorStatSort = {
  sortBy: "code",
  sortDirection: "asc",
};

function compareCodes(left: string, right: string) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareStats(left: TargetColorStat, right: TargetColorStat, sort: ColorStatSort) {
  const codeOrder = compareCodes(left.code, right.code);
  if (sort.sortBy === "code") {
    return sort.sortDirection === "asc" ? codeOrder : -codeOrder;
  }

  const countOrder = left.count - right.count;
  if (countOrder !== 0) {
    return sort.sortDirection === "asc" ? countOrder : -countOrder;
  }

  return codeOrder;
}

export function buildTargetColorStats(
  project: BeadProject,
  paletteMappings: PaletteMapping[],
  sort: ColorStatSort = DEFAULT_SORT,
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
    .sort((left, right) => compareStats(left, right, sort));
}
