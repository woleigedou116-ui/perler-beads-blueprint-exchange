import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmMapping,
  exportUrl,
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
  importImage: vi.fn(),
  openProject: vi.fn(),
  saveAttribution: vi.fn(),
}));

const patternFile = new File(["pattern"], "pattern.png", { type: "image/png" });

async function importPattern() {
  vi.mocked(importImage).mockResolvedValue(projectWithOneReviewCell);
  render(<WorkbenchPage />);
  await userEvent.upload(screen.getByLabelText("上传图纸"), patternFile);
  await userEvent.click(screen.getByRole("button", { name: "开始识别" }));
}

describe("WorkbenchPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("uploads a MARD pattern and shows review and export actions", async () => {
    await importPattern();

    expect(await screen.findByText("待确认 1 项")).toBeInTheDocument();
    expect(screen.getByText("网格 1 x 2")).toBeInTheDocument();
    expect(screen.getByText("MARD H7")).toBeInTheDocument();
    expect(screen.getByText("COCO B09")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出图纸" })).toBeEnabled();
  });

  it("confirms a recommended mapping for matching cells", async () => {
    vi.mocked(confirmMapping).mockResolvedValue(projectAfterMappingConfirmation);
    await importPattern();

    await userEvent.click(
      await screen.findByRole("button", { name: "确认 H7 -> B09" }),
    );

    expect(confirmMapping).toHaveBeenCalledWith("pattern-1", "H7", "B09");
    expect(await screen.findByText("待确认 0 项")).toBeInTheDocument();
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
    render(<WorkbenchPage />);
    const projectFile = new File(["saved"], "pattern.beadproject");

    await userEvent.upload(screen.getByLabelText("打开项目"), projectFile);

    expect(openProject).toHaveBeenCalledWith(projectFile);
    expect(await screen.findByText("待确认 1 项")).toBeInTheDocument();
  });
});
