import { expect, it } from "vitest";

import type { BeadProject } from "../../domain/types";
import { buildTargetColorStats } from "./colorStats";
import { projectWithOneReviewCell } from "./test-data";

function projectWithTargetCodes(codes: string[]): BeadProject {
  return {
    ...projectWithOneReviewCell,
    grid: {
      ...projectWithOneReviewCell.grid,
      columns: codes.length,
      x_lines: Array.from({ length: codes.length + 1 }, (_, index) => index * 32),
    },
    cells: codes.map((code, index) => ({
      ...projectWithOneReviewCell.cells[index % projectWithOneReviewCell.cells.length],
      column: index,
      target_code: code,
    })),
  };
}

it("sorts target color statistics naturally by code by default", () => {
  const stats = buildTargetColorStats(
    projectWithTargetCodes(["A10", "A2", "B01"]),
    [],
  );

  expect(stats.map((stat) => stat.code)).toEqual(["A2", "A10", "B01"]);
});

it("can sort target color statistics by quantity descending", () => {
  const stats = buildTargetColorStats(
    projectWithTargetCodes(["A10", "B09", "B09", "K07", "K07", "K07"]),
    [],
    { sortBy: "count", sortDirection: "desc" },
  );

  expect(stats.map((stat) => `${stat.code}:${stat.count}`)).toEqual([
    "K07:3",
    "B09:2",
    "A10:1",
  ]);
});
