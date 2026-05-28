import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { GridPreview } from "./GridPreview";
import { projectWithOneReviewCell } from "./test-data";

afterEach(() => {
  cleanup();
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
