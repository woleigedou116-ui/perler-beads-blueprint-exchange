import { afterEach, expect, it, vi } from "vitest";

import { getPalette, markCellUnwanted, markRegionUnwanted } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("normalizes palette RGB arrays from the API into UI color objects", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        version: "mard-coco.v1",
        mappings: [
          {
            source_code: "B7",
            source_rgb: [24, 142, 127],
            target_code: "G05",
            target_rgb: [26, 144, 125],
            requires_review: false,
          },
        ],
      }),
    })),
  );

  await expect(getPalette()).resolves.toEqual({
    version: "mard-coco.v1",
    mappings: [
      {
        source_code: "B7",
        source_rgb: { r: 24, g: 142, b: 127 },
        target_code: "G05",
        target_rgb: { r: 26, g: 144, b: 125 },
        requires_review: false,
      },
    ],
  });
});

it("marks a single cell as unwanted", async () => {
  const project = { id: "project-1" };
  const fetch = vi.fn(async () => ({
    ok: true,
    json: async () => project,
  }));
  vi.stubGlobal("fetch", fetch);

  await expect(markCellUnwanted("project-1", 2, 3)).resolves.toBe(project);

  expect(fetch).toHaveBeenCalledWith(
    "/api/projects/project-1/cells/unwanted",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: 2, column: 3 }),
    },
  );
});

it("marks a rectangular grid region as unwanted", async () => {
  const project = { id: "project-1" };
  const fetch = vi.fn(async () => ({
    ok: true,
    json: async () => project,
  }));
  vi.stubGlobal("fetch", fetch);

  await expect(
    markRegionUnwanted("project-1", 1, 2, 4, 5),
  ).resolves.toBe(project);

  expect(fetch).toHaveBeenCalledWith(
    "/api/projects/project-1/cells/unwanted",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_row: 1,
        start_column: 2,
        end_row: 4,
        end_column: 5,
      }),
    },
  );
});
