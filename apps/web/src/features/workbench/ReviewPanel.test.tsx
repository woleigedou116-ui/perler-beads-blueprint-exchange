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
      paletteMappings={paletteMappings}
      project={projectWithOneReviewCell}
      selectedCell={projectWithOneReviewCell.cells[0]}
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
    "改为 B09",
    "改为 K07",
    "改为 K26",
  ]);

  await userEvent.click(screen.getByRole("button", { name: "改为 B09" }));
  expect(onCorrectCell).toHaveBeenCalledWith(
    projectWithOneReviewCell.cells[0],
    "H7",
    "B09",
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
      paletteMappings={paletteMappings}
      project={repeatedReviewProject}
      selectedCell={null}
      onConfirmMapping={onConfirmMapping}
      onCorrectCell={onCorrectCell}
      onLocateCell={onLocateCell}
      onSelectCell={onSelectCell}
    />,
  );

  expect(screen.getByText("待确认 3 格 / 2 组")).toBeInTheDocument();
  expect(screen.getAllByText("MARD H5")).toHaveLength(1);
  expect(screen.getByText("涉及 2 格")).toBeInTheDocument();
  expect(screen.getByText("mapping-unverified, ocr-color-conflict")).toBeInTheDocument();

  const groupedCard = screen.getByLabelText("MARD H5 到 COCO B06，涉及 2 格");
  await userEvent.click(within(groupedCard).getByRole("button", { name: "定位" }));
  expect(onLocateCell).toHaveBeenCalledWith(repeatedReviewProject.cells[0]);
  expect(onSelectCell).toHaveBeenCalledWith(repeatedReviewProject.cells[0]);

  await userEvent.click(within(groupedCard).getByRole("button", { name: "确认" }));
  expect(onConfirmMapping).toHaveBeenCalledWith(repeatedReviewProject.cells[0]);
});
