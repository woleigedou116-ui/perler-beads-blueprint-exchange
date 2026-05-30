import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  confirmMapping,
  correctCell,
  exportUrl,
  getPalette,
  importImage,
  markCellUnwanted,
  markRegionUnwanted,
  openProject,
} from "../../api/client";
import { saveExport } from "../../api/exports";
import { WorkbenchPage } from "./WorkbenchPage";
import {
  projectAfterMappingConfirmation,
  projectWithOneReviewCell,
} from "./test-data";
import type { BeadProject } from "../../domain/types";

vi.mock("../../api/client", () => ({
  confirmMapping: vi.fn(),
  correctCell: vi.fn(),
  exportUrl: vi.fn(() => "/download"),
  getPalette: vi.fn(),
  importImage: vi.fn(),
  markCellUnwanted: vi.fn(),
  markRegionUnwanted: vi.fn(),
  openProject: vi.fn(),
  saveAttribution: vi.fn(),
}));
vi.mock("../../api/exports", () => ({
  saveExport: vi.fn(),
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

async function importPattern(project: BeadProject = projectWithOneReviewCell) {
  vi.mocked(importImage).mockResolvedValue(project);
  vi.mocked(getPalette).mockResolvedValue({
    version: "mard-coco.v1",
    mappings: paletteMappings,
  });
  render(<WorkbenchPage />);
  await userEvent.upload(screen.getByLabelText("上传图纸"), patternFile);
  await userEvent.click(screen.getByRole("button", { name: "开始识别" }));
}

const projectWithThreeReviewGroups: BeadProject = {
  ...projectWithOneReviewCell,
  grid: {
    ...projectWithOneReviewCell.grid,
    columns: 3,
    x_lines: [0, 32, 64, 96],
  },
  cells: [
    {
      ...projectWithOneReviewCell.cells[0],
      column: 0,
      detected_source_code: "A1",
      target_code: "T1",
    },
    {
      ...projectWithOneReviewCell.cells[0],
      column: 1,
      detected_source_code: "B1",
      target_code: "T2",
    },
    {
      ...projectWithOneReviewCell.cells[0],
      column: 2,
      detected_source_code: "C1",
      target_code: "T3",
    },
  ],
};

function projectAfterConfirmingGroup(sourceCode: string) {
  return {
    ...projectWithThreeReviewGroups,
    cells: projectWithThreeReviewGroups.cells.map((cell) =>
      cell.detected_source_code === sourceCode
        ? {
            ...cell,
            confirmed_source_code: sourceCode,
            status: "confirmed" as const,
            issue_reasons: ["user-confirmed-mapping"],
          }
        : cell,
    ),
  };
}

function projectAfterCorrectingCell(column: number, sourceCode: string, targetCode: string) {
  return {
    ...projectWithThreeReviewGroups,
    cells: projectWithThreeReviewGroups.cells.map((cell) =>
      cell.column === column
        ? {
            ...cell,
            confirmed_source_code: sourceCode,
            target_code: targetCode,
            status: "confirmed" as const,
            issue_reasons: ["user-corrected"],
          }
        : cell,
    ),
  };
}

const projectAfterMarkingFirstCellUnwanted: BeadProject = {
  ...projectWithOneReviewCell,
  cells: projectWithOneReviewCell.cells.map((cell) =>
    cell.row === 0 && cell.column === 0
      ? {
          ...cell,
          sampled_color: null,
          detected_source_code: null,
          confirmed_source_code: null,
          target_code: null,
          confidence: 0,
          status: "empty" as const,
          issue_reasons: [],
        }
      : cell,
  ),
};

const projectWithRegionReviewCells: BeadProject = {
  ...projectWithOneReviewCell,
  grid: {
    ...projectWithOneReviewCell.grid,
    rows: 2,
    columns: 3,
    bounds: [0, 0, 96, 64],
    x_lines: [0, 32, 64, 96],
    y_lines: [0, 32, 64],
  },
  cells: Array.from({ length: 6 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return {
      ...projectWithOneReviewCell.cells[0],
      row,
      column,
      detected_source_code: column === 2 ? "F14" : "H7",
      target_code: column === 2 ? "K07" : "B09",
    };
  }),
};

const projectAfterMarkingRegionUnwanted: BeadProject = {
  ...projectWithRegionReviewCells,
  cells: projectWithRegionReviewCells.cells.map((cell) =>
    cell.row <= 1 && cell.column <= 1
      ? {
          ...cell,
          sampled_color: null,
          detected_source_code: null,
          confirmed_source_code: null,
          target_code: null,
          confidence: 0,
          status: "empty" as const,
          issue_reasons: [],
        }
      : cell,
  ),
};

describe("WorkbenchPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uploads a MARD pattern and shows review and export actions", async () => {
    await importPattern();

    expect(await screen.findByText("待确认 1 格 / 1 组")).toBeInTheDocument();
    expect(screen.getByText("网格 1 x 2")).toBeInTheDocument();
    expect(screen.getByText("MARD H7")).toBeInTheDocument();
    expect(screen.getByText("COCO B09")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出图纸" })).toBeEnabled();
  });

  it("moves export actions into the preview toolbar without the bottom color summary", async () => {
    await importPattern();

    const toolbar = await screen.findByLabelText("预览工具栏");

    expect(within(toolbar).getByRole("button", { name: "全屏查看" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "保存项目" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "导出图纸" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "导出检查图" })).toBeInTheDocument();
    expect(within(toolbar).getByRole("button", { name: "导出清单" })).toBeInTheDocument();
    expect(within(toolbar).getByLabelText("导出时附带色块统计")).toBeInTheDocument();
    expect(screen.queryByLabelText("统计与导出")).not.toBeInTheDocument();
    expect(document.querySelector(".stats-panel")).not.toBeInTheDocument();
    expect(document.querySelector(".chips")).not.toBeInTheDocument();
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

  it("keeps the current source preview when reopening the file picker is canceled", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:source-pattern"),
      revokeObjectURL: vi.fn(),
    });

    await importPattern();
    fireEvent.change(screen.getByLabelText("上传图纸"), { target: { files: [] } });

    expect(await screen.findByAltText("上传原图")).toHaveAttribute(
      "src",
      "blob:source-pattern",
    );
    expect(screen.getByAltText("上传图纸预览")).toHaveAttribute(
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
    expect(await screen.findByText("待确认 0 格 / 0 组")).toBeInTheDocument();
  });

  it("automatically locates the next review group after confirming a middle group", async () => {
    vi.mocked(confirmMapping).mockResolvedValue(projectAfterConfirmingGroup("B1"));
    await importPattern(projectWithThreeReviewGroups);

    const middleGroup = await screen.findByLabelText("MARD B1 到 COCO T2，涉及 1 格");
    await userEvent.click(within(middleGroup).getByRole("button", { name: "确认" }));

    expect(confirmMapping).toHaveBeenCalledWith("pattern-1", "B1", "T2");
    expect(await screen.findByRole("heading", { name: "选中格 1, 3" })).toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll(".focused-cell")).some((element) =>
        element.textContent?.includes("C1"),
      ),
    ).toBe(true);
  });

  it("automatically locates the previous review group after confirming the last group", async () => {
    vi.mocked(confirmMapping).mockResolvedValue(projectAfterConfirmingGroup("C1"));
    await importPattern(projectWithThreeReviewGroups);

    const lastGroup = await screen.findByLabelText("MARD C1 到 COCO T3，涉及 1 格");
    await userEvent.click(within(lastGroup).getByRole("button", { name: "确认" }));

    expect(await screen.findByRole("heading", { name: "选中格 1, 2" })).toBeInTheDocument();
    expect(
      Array.from(document.querySelectorAll(".focused-cell")).some((element) =>
        element.textContent?.includes("B1"),
      ),
    ).toBe(true);
  });

  it("can keep the corrected cell selected when automatic review locating is disabled", async () => {
    vi.mocked(confirmMapping).mockResolvedValue(projectAfterConfirmingGroup("B1"));
    await importPattern(projectWithThreeReviewGroups);

    await userEvent.click(await screen.findByRole("button", { name: "校对设置" }));
    await userEvent.click(screen.getByLabelText("处理后自动定位下一组或上一组"));

    const middleGroup = screen.getByLabelText("MARD B1 到 COCO T2，涉及 1 格");
    await userEvent.click(within(middleGroup).getByRole("button", { name: "确认" }));

    expect(await screen.findByRole("heading", { name: "选中格 1, 2" })).toBeInTheDocument();
    expect(document.querySelectorAll(".focused-cell")).toHaveLength(0);
  });

  it("keeps a manually corrected cell selected and refreshes the redraw preview", async () => {
    vi.mocked(correctCell).mockResolvedValue(projectAfterCorrectingCell(1, "F14", "K07"));
    await importPattern(projectWithThreeReviewGroups);

    const middleGroup = await screen.findByLabelText("MARD B1 到 COCO T2，涉及 1 格");
    await userEvent.click(middleGroup);
    await userEvent.clear(screen.getByLabelText("来源色号"));
    await userEvent.type(screen.getByLabelText("来源色号"), "F14");

    expect(screen.getByLabelText("目标色号")).toHaveValue("K07");

    await userEvent.click(screen.getByRole("button", { name: "修正选中格" }));

    expect(correctCell).toHaveBeenCalledWith("pattern-1", 0, 1, "F14", "K07");
    expect(await screen.findByRole("heading", { name: "选中格 1, 2" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "选中格 1, 3" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "COCO 重绘预览" })).toHaveTextContent("K07");
    expect(screen.getByLabelText("目标色号")).toHaveValue("K07");
  });

  it("marks the selected review cell as not a bead and removes it from review and redraw", async () => {
    vi.mocked(markCellUnwanted).mockResolvedValue(projectAfterMarkingFirstCellUnwanted);
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "标记为非拼豆" }));

    expect(markCellUnwanted).toHaveBeenCalledWith("pattern-1", 0, 0);
    expect(await screen.findByText("待确认 0 格 / 0 组")).toBeInTheDocument();
    expect(screen.queryByLabelText("MARD H7 到 COCO B09，涉及 1 格")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "COCO 重绘预览" })).not.toHaveTextContent("B09");
    expect(screen.getByRole("heading", { name: "选中格 1, 2" })).toBeInTheDocument();
  });

  it("selects, cancels, and applies a normalized unwanted grid-cell region", async () => {
    vi.mocked(markRegionUnwanted).mockResolvedValue(projectAfterMarkingRegionUnwanted);
    await importPattern(projectWithRegionReviewCells);

    await userEvent.click(await screen.findByRole("button", { name: "框选非拼豆区域" }));

    const targetCells = screen
      .getByRole("img", { name: "COCO 重绘预览" })
      .querySelectorAll<SVGGElement>("[data-cell-row][data-cell-column]");
    fireEvent.click(targetCells[4]);
    fireEvent.click(targetCells[0]);

    expect(screen.getByText("已选择 1, 1 到 2, 2")).toBeInTheDocument();
    expect(
      screen
        .getByRole("img", { name: "COCO 重绘预览" })
        .querySelectorAll(".region-selected-cell"),
    ).toHaveLength(4);

    await userEvent.click(screen.getByRole("button", { name: "取消框选" }));

    expect(markRegionUnwanted).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".region-selected-cell")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "框选非拼豆区域" }));
    fireEvent.click(targetCells[4]);
    fireEvent.click(targetCells[0]);
    await userEvent.click(screen.getByRole("button", { name: "应用框选区域" }));

    expect(markRegionUnwanted).toHaveBeenCalledWith("pattern-1", 0, 0, 1, 1);
    expect(await screen.findByText("待确认 2 格 / 1 组")).toBeInTheDocument();
    expect(screen.queryByLabelText("MARD H7 到 COCO B09，涉及 4 格")).not.toBeInTheDocument();
    expect(screen.getByLabelText("MARD F14 到 COCO K07，涉及 2 格")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "COCO 重绘预览" })).not.toHaveTextContent("B09");
  });

  it("keeps manual source-cell selection editable and visually focused", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:source-pattern"),
      revokeObjectURL: vi.fn(),
    });
    await importPattern(projectAfterMappingConfirmation);

    const sourceImage = await screen.findByAltText("上传原图");
    Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
    Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
    fireEvent.load(sourceImage);

    const hitCells = screen.getByLabelText("原图格子选择层").querySelectorAll("rect");
    fireEvent.click(hitCells[1]);

    expect(await screen.findByRole("heading", { name: "选中格 1, 2" })).toBeInTheDocument();
    expect(document.querySelectorAll(".focused-cell")).toHaveLength(2);
    expect(screen.getByLabelText("来源色号")).toHaveValue("F14");
    expect(screen.getByLabelText("目标色号")).toHaveValue("K07");
  });

  it("uses a single review settings menu for preview statistics and closes it on outside clicks", async () => {
    const projectWithUnevenStats: BeadProject = {
      ...projectWithOneReviewCell,
      grid: {
        ...projectWithOneReviewCell.grid,
        columns: 4,
        x_lines: [0, 32, 64, 96, 128],
      },
      cells: [
        ...projectWithOneReviewCell.cells,
        {
          ...projectWithOneReviewCell.cells[1],
          column: 2,
          target_code: "K07",
        },
        {
          ...projectWithOneReviewCell.cells[1],
          column: 3,
          target_code: "A10",
        },
      ],
    };
    await importPattern(projectWithUnevenStats);

    const statCodes = () =>
      Array.from(
        screen
          .getByLabelText("COCO 色块统计")
          .querySelectorAll<HTMLElement>(".target-color-stat strong"),
      ).map((element) => element.textContent);

    expect(screen.queryByRole("button", { name: "COCO 重绘预览 设置" })).not.toBeInTheDocument();
    expect(statCodes()).toEqual(["A10", "B09", "K07"]);

    await userEvent.click(await screen.findByRole("button", { name: "校对设置" }));
    expect(screen.getByRole("dialog", { name: "校对设置" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "按数量排序" }));
    await userEvent.click(screen.getByRole("button", { name: "倒序" }));

    expect(statCodes()).toEqual(["K07", "A10", "B09"]);

    await userEvent.click(screen.getByText("上传与参数"));
    expect(screen.queryByRole("dialog", { name: "校对设置" })).not.toBeInTheDocument();
  });

  it("locates a review cell and offers palette-backed correction candidates", async () => {
    vi.mocked(correctCell).mockResolvedValue(projectAfterMappingConfirmation);
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "定位" }));

    expect(document.querySelectorAll(".focused-cell")).toHaveLength(2);
    expect(
      document.querySelector<HTMLElement>(".preview-transform")?.style.transform,
    ).toMatch(/^translate\(.+\) scale\(1\)$/);

    await userEvent.click(screen.getByRole("button", { name: "修改" }));
    await userEvent.click(screen.getByRole("button", { name: "H7" }));

    expect(correctCell).toHaveBeenCalledWith("pattern-1", 0, 0, "H7", "B09");
  });

  it("opens the floating palette reference for the current project", async () => {
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "色号表" }));

    expect(screen.getByText("H7 -> B09")).toBeInTheDocument();
    expect(screen.getByText("F14 -> K07")).toBeInTheDocument();
  });

  it("toggles target color block statistics in the redraw preview", async () => {
    await importPattern();

    const stats = await screen.findByLabelText("COCO 色块统计");
    expect(stats).toHaveTextContent("B09");
    expect(stats).toHaveTextContent("K07");
    expect(screen.getByLabelText("B09 色块")).toHaveStyle({
      backgroundColor: "rgb(14, 14, 14)",
    });

    await userEvent.click(screen.getByRole("button", { name: "隐藏色块统计" }));

    expect(screen.queryByLabelText("COCO 色块统计")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "显示色块统计" })).toBeInTheDocument();
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

  it("adds the color-statistics export option to image downloads", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await importPattern();

    await userEvent.click(await screen.findByRole("button", { name: "导出图纸" }));
    expect(exportUrl).toHaveBeenCalledWith("pattern-1", "clean.png", {
      includeColorStats: true,
    });
    expect(saveExport).toHaveBeenCalledWith("/download", "clean.png");

    await userEvent.click(screen.getByLabelText("导出时附带色块统计"));
    await userEvent.click(screen.getByRole("button", { name: "导出检查图" }));

    expect(exportUrl).toHaveBeenLastCalledWith("pattern-1", "overlay.png", {
      includeColorStats: false,
    });
    expect(saveExport).toHaveBeenLastCalledWith("/download", "overlay.png");
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
    expect(await screen.findByText("待确认 1 格 / 1 组")).toBeInTheDocument();
  });

  it("clears the recognition progress after reopening a saved project", async () => {
    vi.mocked(getPalette).mockResolvedValue({
      version: "mard-coco.v1",
      mappings: paletteMappings,
    });
    let resolveImport: (project: BeadProject) => void = () => undefined;
    vi.mocked(importImage).mockReturnValue(
      new Promise((resolve) => {
        resolveImport = resolve;
      }),
    );
    vi.mocked(openProject).mockResolvedValue(projectWithOneReviewCell);
    render(<WorkbenchPage />);

    await userEvent.upload(screen.getByLabelText("上传图纸"), patternFile);
    await userEvent.click(screen.getByRole("button", { name: "开始识别" }));
    expect(await screen.findByText("上传图纸中")).toBeInTheDocument();

    resolveImport(projectWithOneReviewCell);
    expect(await screen.findByText("待确认 1 格 / 1 组")).toBeInTheDocument();
    await userEvent.upload(
      screen.getByLabelText("打开项目"),
      new File(["saved"], "pattern.beadproject"),
    );

    expect(openProject).toHaveBeenCalled();
    expect(screen.queryByRole("progressbar", { name: "识别进度" })).not.toBeInTheDocument();
    expect(screen.queryByText("上传图纸中")).not.toBeInTheDocument();
  });
});
