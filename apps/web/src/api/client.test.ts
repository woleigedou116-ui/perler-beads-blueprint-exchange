import { afterEach, expect, it, vi } from "vitest";

import { getPalette } from "./client";

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
