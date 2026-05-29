import { afterEach, expect, it, vi } from "vitest";

import { saveExport } from "./exports";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("uses the system save dialog when the browser supports it", async () => {
  const write = vi.fn(async () => undefined);
  const close = vi.fn(async () => undefined);
  const picker = vi.fn(async () => ({
    createWritable: async () => ({ write, close }),
  }));
  const blob = new Blob(["png"], { type: "image/png" });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, blob: async () => blob })));
  vi.stubGlobal("showSaveFilePicker", picker);

  await saveExport("/download", "clean.png");

  expect(picker).toHaveBeenCalledWith({
    suggestedName: "clean.png",
    types: [{ description: "PNG 图片", accept: { "image/png": [".png"] } }],
  });
  expect(write).toHaveBeenCalledWith(blob);
  expect(close).toHaveBeenCalled();
});

it("falls back to browser download when save dialog is unavailable", async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

  await saveExport("/download", "mapping.csv");

  expect(click).toHaveBeenCalled();
});
