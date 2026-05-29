import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { BeadProject, PaletteMapping } from "../../domain/types";
import { ReviewPanel } from "./ReviewPanel";
import { projectWithOneReviewCell } from "./test-data";

afterEach(() => {
  cleanup();
});

const paletteMappings: PaletteMapping[] = [
  {
    source_code: "H2",
    source_rgb: { r: 252, g: 252, b: 248 },
    target_code: "A01",
    target_rgb: { r: 252, g: 252, b: 248 },
    requires_review: false,
  },
  {
    source_code: "H4",
    source_rgb: { r: 224, g: 224, b: 224 },
    target_code: "A02",
    target_rgb: { r: 224, g: 224, b: 224 },
    requires_review: false,
  },
  {
    source_code: "H3",
    source_rgb: { r: 180, g: 180, b: 180 },
    target_code: "A10",
    target_rgb: { r: 180, g: 180, b: 180 },
    requires_review: false,
  },
  {
    source_code: "F14",
    source_rgb: { r: 247, g: 152, b: 158 },
    target_code: "K07",
    target_rgb: { r: 247, g: 150, b: 157 },
    requires_review: false,
  },
  {
    source_code: "H7",
    source_rgb: { r: 14, g: 14, b: 14 },
    target_code: "B09",
    target_rgb: { r: 14, g: 14, b: 14 },
    requires_review: false,
  },
  {
    source_code: "E20",
    source_rgb: { r: 239, g: 225, b: 233 },
    target_code: "K26",
    target_rgb: { r: 239, g: 224, b: 232 },
    requires_review: false,
  },
];

it("locates, confirms, and corrects a review cell from nearest color candidates", async () => {
  const onConfirmMapping = vi.fn();
  const onCorrectCell = vi.fn();
  const onLocateCell = vi.fn();
  const onSelectCell = vi.fn();

  render(
    <ReviewPanel
      autoLocateAfterDecision
      paletteMappings={paletteMappings}
      project={projectWithOneReviewCell}
      selectedCell={projectWithOneReviewCell.cells[0]}
      onAutoLocateAfterDecisionChange={vi.fn()}
      onConfirmMapping={onConfirmMapping}
      onCorrectCell={onCorrectCell}
      onLocateCell={onLocateCell}
      onSelectCell={onSelectCell}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "定位" }));
  expect(onLocateCell).toHaveBeenCalledWith(projectWithOneReviewCell.cells[0]);
  expect(onSelectCell).toHaveBeenCalledWith(projectWithOneReviewCell.cells[0]);

  await userEvent.click(screen.getByRole("button", { name: "确认" }));
  expect(onConfirmMapping).toHaveBeenCalledWith(projectWithOneReviewCell.cells[0]);

  await userEvent.click(screen.getByRole("button", { name: "修改" }));
  const candidates = screen.getByLabelText("近似色号候选");
  const candidateButtons = within(candidates).getAllByRole("button");

  expect(candidateButtons.map((button) => button.textContent)).toEqual([
    "H7",
    "H3",
    "F14",
    "H4",
    "E20",
    "更多",
  ]);

  await userEvent.click(screen.getByRole("button", { name: "H7" }));
  expect(onCorrectCell).toHaveBeenCalledWith(
    projectWithOneReviewCell.cells[0],
    "H7",
    "B09",
  );

  await userEvent.click(screen.getByRole("button", { name: "更多" }));
  const fullPalette = screen.getByLabelText("全部来源色号候选");
  expect(
    within(fullPalette)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["E20", "F14", "H2", "H3", "H4", "H7"]);

  await userEvent.click(within(fullPalette).getByRole("button", { name: "H4" }));
  expect(onCorrectCell).toHaveBeenLastCalledWith(
    projectWithOneReviewCell.cells[0],
    "H4",
    "A02",
  );
});

it("chooses correction candidates from the uploaded source recognition colors", async () => {
  const misleadingTargetPalette: PaletteMapping[] = [
    {
      source_code: "H7",
      source_rgb: { r: 14, g: 14, b: 14 },
      target_code: "B09",
      target_rgb: { r: 250, g: 250, b: 250 },
      requires_review: false,
    },
    {
      source_code: "H2",
      source_rgb: { r: 250, g: 250, b: 250 },
      target_code: "A01",
      target_rgb: { r: 14, g: 14, b: 14 },
      requires_review: false,
    },
  ];

  render(
    <ReviewPanel
      autoLocateAfterDecision
      paletteMappings={misleadingTargetPalette}
      project={projectWithOneReviewCell}
      selectedCell={projectWithOneReviewCell.cells[0]}
      onAutoLocateAfterDecisionChange={vi.fn()}
      onConfirmMapping={vi.fn()}
      onCorrectCell={vi.fn()}
      onLocateCell={vi.fn()}
      onSelectCell={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "修改" }));

  const candidates = within(screen.getByLabelText("近似色号候选")).getAllByRole(
    "button",
  );
  expect(candidates.map((button) => button.textContent)).toEqual([
    "H7",
    "H2",
    "更多",
  ]);
});

it("updates the target code when the editor source code matches the palette", async () => {
  const onCorrectCell = vi.fn();
  render(
    <ReviewPanel
      autoLocateAfterDecision
      paletteMappings={paletteMappings}
      project={projectWithOneReviewCell}
      selectedCell={projectWithOneReviewCell.cells[0]}
      onAutoLocateAfterDecisionChange={vi.fn()}
      onConfirmMapping={vi.fn()}
      onCorrectCell={onCorrectCell}
      onLocateCell={vi.fn()}
      onSelectCell={vi.fn()}
    />,
  );

  await userEvent.clear(screen.getByLabelText("来源色号"));
  await userEvent.type(screen.getByLabelText("来源色号"), "f14");

  expect(screen.getByLabelText("来源色号")).toHaveValue("F14");
  expect(screen.getByLabelText("目标色号")).toHaveValue("K07");

  await userEvent.click(screen.getByRole("button", { name: "修正选中格" }));

  expect(onCorrectCell).toHaveBeenCalledWith(
    projectWithOneReviewCell.cells[0],
    "F14",
    "K07",
  );
});

it("groups repeated review cells by mapping so large patterns stay reviewable", async () => {
  const repeatedReviewProject: BeadProject = {
    ...projectWithOneReviewCell,
    cells: [
      {
        ...projectWithOneReviewCell.cells[0],
        row: 0,
        column: 0,
        detected_source_code: "H5",
        target_code: "B06",
        issue_reasons: ["mapping-unverified", "ocr-color-conflict"],
      },
      {
        ...projectWithOneReviewCell.cells[0],
        row: 0,
        column: 1,
        detected_source_code: "H5",
        target_code: "B06",
        issue_reasons: ["mapping-unverified"],
      },
      {
        ...projectWithOneReviewCell.cells[0],
        row: 0,
        column: 2,
        detected_source_code: "B18",
        target_code: "F07",
        issue_reasons: ["mapping-unverified"],
      },
    ],
  };
  const onConfirmMapping = vi.fn();
  const onCorrectCell = vi.fn();
  const onLocateCell = vi.fn();
  const onSelectCell = vi.fn();

  render(
    <ReviewPanel
      autoLocateAfterDecision
      paletteMappings={paletteMappings}
      project={repeatedReviewProject}
      selectedCell={null}
      onAutoLocateAfterDecisionChange={vi.fn()}
      onConfirmMapping={onConfirmMapping}
      onCorrectCell={onCorrectCell}
      onLocateCell={onLocateCell}
      onSelectCell={onSelectCell}
    />,
  );

  expect(screen.getByText("待确认 3 格 / 2 组")).toBeInTheDocument();
  expect(screen.getAllByText("MARD H5")).toHaveLength(1);
  expect(screen.getByText("涉及 2 格")).toBeInTheDocument();
  expect(screen.getByText("对照表未核验、OCR 色号与取色不一致")).toBeInTheDocument();

  const groupedCard = screen.getByLabelText("MARD H5 到 COCO B06，涉及 2 格");
  await userEvent.click(within(groupedCard).getByRole("button", { name: "定位" }));
  expect(onLocateCell).toHaveBeenCalledWith(repeatedReviewProject.cells[0]);
  expect(onSelectCell).toHaveBeenCalledWith(repeatedReviewProject.cells[0]);

  await userEvent.click(within(groupedCard).getByRole("button", { name: "确认" }));
  expect(onConfirmMapping).toHaveBeenCalledWith(repeatedReviewProject.cells[0]);
});

it("closes review settings when clicking outside the menu", async () => {
  render(
    <div>
      <button type="button">外部区域</button>
      <ReviewPanel
        autoLocateAfterDecision
        paletteMappings={paletteMappings}
        project={projectWithOneReviewCell}
        selectedCell={projectWithOneReviewCell.cells[0]}
        onAutoLocateAfterDecisionChange={vi.fn()}
        onConfirmMapping={vi.fn()}
        onCorrectCell={vi.fn()}
        onLocateCell={vi.fn()}
        onSelectCell={vi.fn()}
      />
    </div>,
  );

  await userEvent.click(screen.getByRole("button", { name: "校对设置" }));
  expect(screen.getByRole("dialog", { name: "校对设置" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "外部区域" }));

  expect(screen.queryByRole("dialog", { name: "校对设置" })).not.toBeInTheDocument();
});
