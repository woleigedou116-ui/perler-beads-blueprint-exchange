import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { PaletteMapping } from "../../domain/types";
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
