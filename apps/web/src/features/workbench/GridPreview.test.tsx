import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { GridPreview } from "./GridPreview";
import { projectAfterMappingConfirmation, projectWithOneReviewCell } from "./test-data";
import type { BeadProject } from "../../domain/types";

afterEach(() => {
  cleanup();
});

it("uses a compact header layout that keeps the title and controls aligned", () => {
  const { container } = render(
    <GridPreview
      actions={<button type="button">隐藏色块统计</button>}
      project={projectWithOneReviewCell}
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  expect(container.querySelector(".preview-card-header")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "COCO 重绘预览" })).toHaveClass(
    "preview-card-title",
  );
  expect(container.querySelector(".preview-standard-pill")).toHaveTextContent("COCO");
});

it("overlays review cells on the uploaded source image within a preview transform", () => {
  const { container } = render(
    <GridPreview
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      focusedCell={projectWithOneReviewCell.cells[0]}
      transform={{ zoom: 1.25, panX: 8, panY: -4 }}
      target={false}
      title="识别叠加视图"
      onSelectCell={vi.fn()}
    />,
  );

  const sourceImage = screen.getByAltText("上传原图");
  expect(sourceImage).toHaveAttribute(
    "src",
    "blob:source-pattern",
  );

  Object.defineProperty(sourceImage, "naturalWidth", { value: 640 });
  Object.defineProperty(sourceImage, "naturalHeight", { value: 320 });
  fireEvent.load(sourceImage);

  const overlay = screen.getByLabelText("待复核标记叠加层");
  expect(overlay).toHaveAttribute("viewBox", "0 0 640 320");
  expect(overlay.querySelectorAll("rect")).toHaveLength(1);
  expect(overlay.querySelector("rect")).toHaveAttribute("width", "32");
  expect(overlay.querySelector("rect")).toHaveClass("focused-cell");
  expect(container.querySelector(".preview-transform")).toHaveStyle({
    transform: "translate(8px, -4px) scale(1.25)",
  });
});

it("prevents the source image from starting native browser drags", () => {
  render(
    <GridPreview
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      showReviewOverlay={false}
      target={false}
      title="识别叠加视图"
      onSelectCell={vi.fn()}
    />,
  );

  const sourceImage = screen.getByAltText("上传原图");
  expect(sourceImage).toHaveAttribute("draggable", "false");
  expect(fireEvent.dragStart(sourceImage)).toBe(false);
});

it("allows selecting confirmed cells from the uploaded source image", () => {
  const onSelectCell = vi.fn();
  render(
    <GridPreview
      project={projectAfterMappingConfirmation}
      sourceImageUrl="blob:source-pattern"
      target={false}
      title="识别叠加视图"
      onSelectCell={onSelectCell}
    />,
  );

  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);

  const hitCells = screen.getByLabelText("原图格子选择层").querySelectorAll("rect");
  expect(hitCells).toHaveLength(2);

  fireEvent.click(hitCells[1]);

  expect(onSelectCell).toHaveBeenCalledWith(projectAfterMappingConfirmation.cells[1]);
});

it("allows selecting empty cells from the uploaded source image", () => {
  const onSelectCell = vi.fn();
  const projectWithEmptyCell = {
    ...projectAfterMappingConfirmation,
    cells: projectAfterMappingConfirmation.cells.map((cell, index) =>
      index === 0
        ? {
            ...cell,
            sampled_color: null,
            detected_source_code: null,
            confirmed_source_code: null,
            target_code: null,
            confidence: 0,
            status: "empty" as const,
          }
        : cell,
    ),
  };
  render(
    <GridPreview
      project={projectWithEmptyCell}
      sourceImageUrl="blob:source-pattern"
      target={false}
      title="识别叠加视图"
      onSelectCell={onSelectCell}
    />,
  );

  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);

  const hitCells = screen.getByLabelText("原图格子选择层").querySelectorAll("rect");
  expect(hitCells).toHaveLength(2);

  fireEvent.click(hitCells[0]);

  expect(onSelectCell).toHaveBeenCalledWith(projectWithEmptyCell.cells[0]);
});

it("uses contrasting stroked label colors for dark and light cells", () => {
  const { container } = render(
    <GridPreview
      project={projectWithOneReviewCell}
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  const [darkCellLabel, lightCellLabel] = Array.from(container.querySelectorAll("text"));
  expect(darkCellLabel).toHaveStyle({
    fill: "rgb(255, 255, 255)",
    stroke: "rgb(25, 25, 25)",
  });
  expect(darkCellLabel).toHaveAttribute("paint-order", "stroke");
  expect(lightCellLabel).toHaveStyle({
    fill: "rgb(25, 25, 25)",
    stroke: "rgb(255, 255, 255)",
  });
  expect(lightCellLabel).toHaveAttribute("paint-order", "stroke");
});

it("uses larger target labels in the regenerated preview", () => {
  const { container } = render(
    <GridPreview
      project={projectWithOneReviewCell}
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  expect(container.querySelector("text")).toHaveStyle({ fontSize: "16px" });
});

it("draws target focus as a separate empty square frame", () => {
  const { container } = render(
    <GridPreview
      focusedCell={projectWithOneReviewCell.cells[1]}
      project={projectWithOneReviewCell}
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  const focusFrame = container.querySelector(".target-focus-frame");
  const focusedGroup = container.querySelector(
    '[data-cell-row="0"][data-cell-column="1"]',
  );

  expect(focusFrame).toBeInTheDocument();
  expect(focusFrame).toHaveAttribute("fill", "none");
  expect(focusFrame).toHaveAttribute("x", "53.5");
  expect(focusFrame).toHaveAttribute("y", "1.5");
  expect(focusFrame).toHaveAttribute("width", "49");
  expect(focusFrame).toHaveAttribute("height", "49");
  expect(focusedGroup).not.toHaveClass("focused-cell");
});

it("can hide cell labels in the regenerated preview while keeping bead colors", () => {
  const { container } = render(
    <GridPreview
      project={projectWithOneReviewCell}
      showCellLabels={false}
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  expect(container.querySelectorAll("text")).toHaveLength(0);
  expect(container.querySelectorAll("rect")).toHaveLength(projectWithOneReviewCell.cells.length);
});

function largeProject(): BeadProject {
  return {
    ...projectWithOneReviewCell,
    id: "large-pattern",
    grid: {
      rows: 100,
      columns: 100,
      bounds: [0, 0, 1000, 1000],
      x_lines: Array.from({ length: 101 }, (_, index) => index * 10),
      y_lines: Array.from({ length: 101 }, (_, index) => index * 10),
    },
    cells: Array.from({ length: 10_000 }, (_, index) => ({
      ...projectWithOneReviewCell.cells[1],
      row: Math.floor(index / 100),
      column: index % 100,
      target_code: `T${index}`,
    })),
  };
}

it("virtualizes regenerated grid cells to the buffered visible range", () => {
  const { container } = render(
    <GridPreview
      contentSize={{ width: 5200, height: 5200 }}
      project={largeProject()}
      transform={{ zoom: 4, panX: -1040, panY: -1560 }}
      viewportSize={{ width: 520, height: 520 }}
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  expect(container.querySelectorAll(".grid-preview g")).toHaveLength(3000);
});

it("virtualizes source hit cells while keeping visible source cells selectable", () => {
  const onSelectCell = vi.fn();
  render(
    <GridPreview
      contentSize={{ width: 500, height: 500 }}
      project={largeProject()}
      sourceImageUrl="blob:source-pattern"
      transform={{ zoom: 5, panX: -1000, panY: -1250 }}
      viewportSize={{ width: 500, height: 500 }}
      target={false}
      title="识别叠加视图"
      onSelectCell={onSelectCell}
    />,
  );

  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 1000 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 1000 });
  fireEvent.load(sourceImage);

  const hitCells = screen.getByLabelText("原图格子选择层").querySelectorAll("rect");
  expect(hitCells).toHaveLength(4356);
  expect(hitCells[0]).toHaveAttribute("data-cell-row", "30");
  expect(hitCells[0]).toHaveAttribute("data-cell-column", "19");

  fireEvent.click(hitCells[0]);

  expect(onSelectCell).toHaveBeenCalledWith(
    expect.objectContaining({ row: 30, column: 19 }),
  );
});

it("renders target color block statistics when requested", () => {
  render(
    <GridPreview
      colorStats={[
        { code: "B09", count: 1, rgb: { r: 14, g: 14, b: 14 } },
        { code: "K07", count: 1, rgb: { r: 247, g: 150, b: 157 } },
      ]}
      project={projectWithOneReviewCell}
      showColorStats
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("COCO 色块统计")).toHaveTextContent("B09");
  expect(screen.getByLabelText("COCO 色块统计")).toHaveTextContent("K07");
  expect(screen.getByLabelText("B09 色块")).toHaveStyle({
    backgroundColor: "rgb(14, 14, 14)",
  });
});

it("uses target palette colors in the regenerated preview when available", () => {
  const recoloredProject = {
    ...projectWithOneReviewCell,
    cells: projectWithOneReviewCell.cells.map((cell) => ({
      ...cell,
      sampled_color: { r: 200, g: 200, b: 200 },
    })),
  };
  const { container } = render(
    <GridPreview
      colorStats={[
        { code: "B09", count: 1, rgb: { r: 14, g: 14, b: 14 } },
        { code: "K07", count: 1, rgb: { r: 247, g: 150, b: 157 } },
      ]}
      project={recoloredProject}
      showColorStats
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  const [darkCell, lightCell] = Array.from(container.querySelectorAll("rect"));
  expect(darkCell).toHaveAttribute("fill", "rgb(14 14 14)");
  expect(lightCell).toHaveAttribute("fill", "rgb(247 150 157)");
});

it("gives regenerated SVG previews explicit dimensions for layout measurement", () => {
  const { container } = render(
    <GridPreview
      project={projectWithOneReviewCell}
      target
      title="COCO 重绘预览"
      onSelectCell={vi.fn()}
    />,
  );

  const preview = container.querySelector(".grid-preview");
  expect(preview).toHaveAttribute("width", "104");
  expect(preview).toHaveAttribute("height", "52");
});

it("waits for source image dimensions before drawing review overlays", () => {
  render(
    <GridPreview
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      target={false}
      title="识别叠加视图"
      onSelectCell={vi.fn()}
    />,
  );

  expect(screen.getByAltText("上传原图")).toHaveAttribute("src", "blob:source-pattern");
  expect(screen.queryByLabelText("待复核标记叠加层")).not.toBeInTheDocument();
});

it("sizes source overlays from the loaded image so review cells align with the rendered image", () => {
  render(
    <GridPreview
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      target={false}
      title="识别叠加视图"
      onSelectCell={vi.fn()}
    />,
  );

  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 1440 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 1499 });
  fireEvent.load(sourceImage);

  expect(sourceImage).toHaveAttribute("width", "1440");
  expect(sourceImage).toHaveAttribute("height", "1499");
  expect(screen.getByLabelText("待复核标记叠加层")).toHaveAttribute(
    "viewBox",
    "0 0 1440 1499",
  );
});

it("can hide review overlay markers while keeping the source image visible", () => {
  render(
    <GridPreview
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      showReviewOverlay={false}
      target={false}
      title="识别叠加视图"
      onSelectCell={vi.fn()}
    />,
  );

  expect(screen.getByAltText("上传原图")).toHaveAttribute("src", "blob:source-pattern");
  expect(screen.queryByLabelText("待复核标记叠加层")).not.toBeInTheDocument();
});

it("keeps source region selection visible when review overlay markers are hidden", () => {
  render(
    <GridPreview
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      selectedRegionBounds={{ startRow: 0, startColumn: 0, endRow: 0, endColumn: 0 }}
      showReviewOverlay={false}
      target={false}
      title="识别叠加视图"
      onSelectCell={vi.fn()}
    />,
  );

  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);

  const overlay = screen.getByLabelText("待复核标记叠加层");
  const selectedCells = overlay.querySelectorAll(".region-selected-cell");
  expect(selectedCells).toHaveLength(1);
});
