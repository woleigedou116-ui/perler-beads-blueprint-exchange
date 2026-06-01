import { afterEach, describe, expect, it, vi } from "vitest";

import { saveExport } from "./fileActions";

describe("fileActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("falls back to an anchor download when the save picker is unavailable", async () => {
    const click = vi.fn();
    const createElement = vi.spyOn(document, "createElement");
    createElement.mockReturnValue({
      click,
      href: "",
      download: "",
    } as unknown as HTMLAnchorElement);

    await saveExport("/api/export", "mapping.csv");

    const link = createElement.mock.results[0].value as HTMLAnchorElement;
    expect(link.href).toContain("/api/export");
    expect(link.download).toBe("mapping.csv");
    expect(click).toHaveBeenCalledOnce();
  });

  it("uses the browser save picker when available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable });
    const blob = new Blob(["csv"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    vi.stubGlobal("showSaveFilePicker", showSaveFilePicker);

    await saveExport("/api/export", "mapping.csv");

    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "mapping.csv",
      types: [{ description: "CSV 表格", accept: { "text/csv": [".csv"] } }],
    });
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalledOnce();
  });

  it("ignores cancelled save picker dialogs", async () => {
    vi.stubGlobal(
      "showSaveFilePicker",
      vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
    );

    await expect(saveExport("/api/export", "clean.png")).resolves.toBeUndefined();
  });
});
