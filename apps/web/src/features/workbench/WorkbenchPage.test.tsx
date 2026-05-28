import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmMapping,
  correctCell,
  exportUrl,
  getPalette,
  importImage,
  openProject,
} from "../../api/client";
import { WorkbenchPage } from "./WorkbenchPage";
import {
  projectAfterMappingConfirmation,
  projectWithOneReviewCell,
} from "./test-data";

vi.mock("../../api/client", () => ({
  confirmMapping: vi.fn(),
  correctCell: vi.fn(),
  exportUrl: vi.fn(() => "/download"),
  getPalette: vi.fn(),
  importImage: vi.fn(),
  openProject: vi.fn(),
  saveAttribution: vi.fn(),
}));

const patternFile = new File(["pattern"], "pattern.png", { type: "image/png" });
const paletteMappings = [
  {
    source_code: "H7",
    source_rgb: { r: 14, g: 14, b: 14 },
    target_code: "B09",
    target_rgb: { r: 14, g: 14, b: 14 },
    requires_review: false,
  },
  {
    source_code: "F14",
    source_rgb: { r: 247, g: 152, b: 158 },
    target_code: "K07",
    target_rgb: { r: 247, g: 150, b: 157 },
    requires_review: false,
  },
];

async function importPattern() {
  vi.mocked(importImage).mockResolvedValue(projectWithOneReviewCell);
  vi.mocked(getPalette).mockResolvedValue({
    version: "mard-coco.v1",
    mappings: paletteMappings,
  });
  render(<WorkbenchPage />);
  await userEvent.upload(screen.getByLabelText("上传图纸"), patternFile);
  await userEvent.click(screen.getByRole("button", { name: "开始识别" }));
}

describe("WorkbenchPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uploads a MARD pattern and shows review and export actions", async () => {
    await importPattern();

    expect(await screen.findByText("待确认 1 项")).toBeInTheDocument();
    expect(screen.getByText("网格 1 x 2")).toBeInTheDocument();
    expect(screen.getByText("MARD H7")).toBeInTheDocument();
    expect(screen.getByText("COCO B09")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出图纸" })).toBeEnabled();
  });

  it("shows staged recognition progress while image import is pending", async () => {
    vi.mocked(getPalette).mockResolvedValue({
      version: "mard-coco.v1",
      mappings: paletteMappings,
    });
    vi.mocked(importImage).mockReturnValue(new Promise(() => undefined));
    render(<WorkbenchPage />);

    await userEvent.upload(screen.getByLabelText("上传图纸"), patternFile);
    await userEvent.click(screen.getByRole("button", { name: "开始识别" }));

    const progress = await screen.findByRole("progressbar", { name: "识别进度" });
    expect(progress).toHaveAttribute("aria-valuenow", "12");
    expect(screen.getByText("上传图纸中")).toBeInTheDocument();
  });

  it("uses the uploaded image behind the recognition overlay", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:source-pattern"),
      revokeObjectURL: vi.fn(),
    });

    await importPattern();

    expect(await screen.findByAltText("上传原图")).toHaveAttribute(
      "src",
      "blob:source-pattern",
    );
  });

  it("expands the preview area for full-screen review and exits with Escape", async () => {
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "全屏查看" }));

    const workbench = screen.getByLabelText("拼豆转换工作台");
    expect(workbench).toHaveClass("review-fullscreen");
    expect(screen.getByRole("button", { name: "退出全屏" })).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(workbench).not.toHaveClass("review-fullscreen");
    expect(screen.getByRole("button", { name: "全屏查看" })).toBeInTheDocument();
  });

  it("confirms a recommended mapping for matching cells", async () => {
    vi.mocked(confirmMapping).mockResolvedValue(projectAfterMappingConfirmation);
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "确认" }));

    expect(confirmMapping).toHaveBeenCalledWith("pattern-1", "H7", "B09");
    expect(await screen.findByText("待确认 0 项")).toBeInTheDocument();
  });

  it("locates a review cell and offers palette-backed correction candidates", async () => {
    vi.mocked(correctCell).mockResolvedValue(projectAfterMappingConfirmation);
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "定位" }));

    expect(document.querySelectorAll(".focused-cell")).toHaveLength(2);
    expect(
      document.querySelector<HTMLElement>(".preview-transform")?.style.transform,
    ).toContain("scale(2)");

    await userEvent.click(screen.getByRole("button", { name: "修改" }));
    await userEvent.click(screen.getByRole("button", { name: "改为 B09" }));

    expect(correctCell).toHaveBeenCalledWith("pattern-1", 0, 0, "H7", "B09");
  });

  it("opens the floating palette reference for the current project", async () => {
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "色号表" }));

    expect(screen.getByText("H7 -> B09")).toBeInTheDocument();
    expect(screen.getByText("F14 -> K07")).toBeInTheDocument();
  });

  it("requires confirmation before exporting unresolved output", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await importPattern();

    await userEvent.click(
      await screen.findByRole("button", { name: "导出图纸" }),
    );

    expect(confirm).toHaveBeenCalledWith(
      "当前仍有 1 个待确认格子，导出结果可能使用推荐颜色。仍要导出吗？",
    );
    expect(exportUrl).not.toHaveBeenCalled();
  });

  it("reopens a saved project file for further review", async () => {
    vi.mocked(openProject).mockResolvedValue(projectWithOneReviewCell);
    vi.mocked(getPalette).mockResolvedValue({
      version: "mard-coco.v1",
      mappings: paletteMappings,
    });
    render(<WorkbenchPage />);
    const projectFile = new File(["saved"], "pattern.beadproject");

    await userEvent.upload(screen.getByLabelText("打开项目"), projectFile);

    expect(openProject).toHaveBeenCalledWith(projectFile);
    expect(await screen.findByText("待确认 1 项")).toBeInTheDocument();
  });
});
