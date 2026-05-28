import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { ComparisonPreview } from "./ComparisonPreview";
import { projectWithOneReviewCell } from "./test-data";

afterEach(() => {
  cleanup();
});

function renderPreview() {
  const onFullscreenChange = vi.fn();
  return render(
    <ComparisonPreview
      fullscreen={false}
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={onFullscreenChange}
      onSelectCell={vi.fn()}
    />,
  );
}

function transforms(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(".preview-transform")).map(
    (element) => element.style.transform,
  );
}

function firePointer(
  element: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  pointer: { pointerId: number; clientX?: number; clientY?: number },
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: pointer.clientX ?? 0 },
    clientY: { value: pointer.clientY ?? 0 },
    pointerId: { value: pointer.pointerId },
  });
  fireEvent(element, event);
}

function setReadOnlyNumberProperty(element: Element, name: string, value: number) {
  Object.defineProperty(element, name, {
    configurable: true,
    value,
  });
}

function setPreviewSize(
  container: HTMLElement,
  index: number,
  size: { width: number; height: number },
) {
  const viewport = container.querySelectorAll(".preview-viewport")[index];
  const transform = container.querySelectorAll(".preview-transform")[index];
  setReadOnlyNumberProperty(viewport, "clientWidth", size.width);
  setReadOnlyNumberProperty(viewport, "clientHeight", size.height);
  setReadOnlyNumberProperty(transform, "clientWidth", size.width);
  setReadOnlyNumberProperty(transform, "clientHeight", size.height);
}

it("applies zoom and panning independently for each blueprint preview", async () => {
  const { container } = renderPreview();
  setPreviewSize(container, 0, { width: 400, height: 200 });
  setPreviewSize(container, 1, { width: 400, height: 200 });

  await userEvent.click(screen.getByRole("button", { name: "识别叠加视图 放大" }));

  expect(screen.getByLabelText("识别叠加视图 缩放比例")).toHaveTextContent("125%");
  expect(transforms(container)).toEqual([
    "translate(-50px, -25px) scale(1.25)",
    "translate(0px, 0px) scale(1)",
  ]);

  fireEvent.wheel(container.querySelectorAll(".preview-viewport")[1], {
    deltaY: -100,
  });

  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("125%");
  expect(transforms(container)).toEqual([
    "translate(-50px, -25px) scale(1.25)",
    "translate(-50px, -25px) scale(1.25)",
  ]);

  const secondViewport = container.querySelectorAll(".preview-viewport")[1];
  firePointer(secondViewport, "pointerdown", { pointerId: 1, clientX: 10, clientY: 20 });
  firePointer(secondViewport, "pointermove", { pointerId: 1, clientX: 34, clientY: 36 });
  firePointer(secondViewport, "pointerup", { pointerId: 1 });

  expect(transforms(container)).toEqual([
    "translate(-50px, -25px) scale(1.25)",
    "translate(-26px, -9px) scale(1.25)",
  ]);

  await userEvent.click(screen.getByRole("button", { name: "COCO 重绘预览 重置" }));

  expect(transforms(container)).toEqual([
    "translate(-50px, -25px) scale(1.25)",
    "translate(0px, 0px) scale(1)",
  ]);
  expect(screen.getByRole("button", { name: "识别叠加视图 重置" })).toHaveTextContent(
    /^重置$/,
  );
  expect(screen.getByRole("button", { name: "COCO 重绘预览 重置" })).toHaveTextContent(
    /^重置$/,
  );
});

it("allows zooming deep enough for detailed bead review", async () => {
  renderPreview();

  const zoomIn = screen.getByRole("button", { name: "识别叠加视图 放大" });
  for (let index = 0; index < 28; index += 1) {
    await userEvent.click(zoomIn);
  }

  expect(screen.getByLabelText("识别叠加视图 缩放比例")).toHaveTextContent("800%");
});

it("toggles source review overlays without hiding the uploaded image", async () => {
  const { container } = renderPreview();
  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);

  expect(sourceImage).toHaveAttribute("src", "blob:source-pattern");
  expect(screen.getByLabelText("待复核标记叠加层")).toBeInTheDocument();
  expect(
    within(screen.getByLabelText("预览工具栏")).queryByRole("button", {
      name: "隐藏叠加",
    }),
  ).not.toBeInTheDocument();
  expect(
    within(container.querySelectorAll(".preview-card-actions")[0] as HTMLElement).getByRole(
      "button",
      {
        name: "隐藏叠加",
      },
    ),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "隐藏叠加" }));

  expect(screen.getByAltText("上传原图")).toBeInTheDocument();
  expect(screen.queryByLabelText("待复核标记叠加层")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "显示叠加" })).toBeInTheDocument();
});

it("focuses a requested cell in both previews", () => {
  const { container, rerender } = renderPreview();
  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);
  const [sourceTransform, targetTransform] = container.querySelectorAll(".preview-transform");
  setReadOnlyNumberProperty(sourceTransform, "clientWidth", 640);
  setReadOnlyNumberProperty(sourceTransform, "clientHeight", 320);
  setReadOnlyNumberProperty(targetTransform, "clientWidth", 520);
  setReadOnlyNumberProperty(targetTransform, "clientHeight", 260);

  rerender(
    <ComparisonPreview
      fullscreen={false}
      focusRequest={{ cell: projectWithOneReviewCell.cells[0], nonce: 1 }}
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={vi.fn()}
      onSelectCell={vi.fn()}
    />,
  );

  expect(transforms(container)[0]).toBe("translate(0px, -160px) scale(2)");
  expect(transforms(container)[1]).toBe("translate(0px, -130px) scale(2)");
  expect(container.querySelectorAll(".focused-cell")).toHaveLength(2);
});

it("syncs target zoom to the current source zoom when locating a review cell", async () => {
  const { container, rerender } = renderPreview();
  setPreviewSize(container, 0, { width: 400, height: 200 });
  setPreviewSize(container, 1, { width: 400, height: 200 });
  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);

  const zoomIn = screen.getByRole("button", { name: "识别叠加视图 放大" });
  await userEvent.click(zoomIn);
  await userEvent.click(zoomIn);
  await userEvent.click(zoomIn);

  rerender(
    <ComparisonPreview
      fullscreen={false}
      focusRequest={{ cell: projectWithOneReviewCell.cells[0], nonce: 2 }}
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={vi.fn()}
      onSelectCell={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("识别叠加视图 缩放比例")).toHaveTextContent("175%");
  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("175%");
  expect(transforms(container)[1]).toContain("scale(1.75)");
});

it("requests entering and exiting full-screen review mode", async () => {
  const enter = vi.fn();
  const { rerender } = render(
    <ComparisonPreview
      fullscreen={false}
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={enter}
      onSelectCell={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "全屏查看" }));
  expect(enter).toHaveBeenCalledWith(true);

  const exit = vi.fn();
  rerender(
    <ComparisonPreview
      fullscreen
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={exit}
      onSelectCell={vi.fn()}
    />,
  );

  await userEvent.click(screen.getByRole("button", { name: "退出全屏" }));
  expect(exit).toHaveBeenCalledWith(false);
});
