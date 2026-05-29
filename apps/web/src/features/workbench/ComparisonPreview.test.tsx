import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import type { BeadProject } from "../../domain/types";
import { ComparisonPreview } from "./ComparisonPreview";
import { projectWithOneReviewCell } from "./test-data";

afterEach(() => {
  cleanup();
});

function renderPreview(project: BeadProject = projectWithOneReviewCell) {
  const onFullscreenChange = vi.fn();
  return render(
    <ComparisonPreview
      fullscreen={false}
      project={project}
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
  viewportSize: { width: number; height: number },
  contentSize = viewportSize,
) {
  const viewport = container.querySelectorAll(".preview-viewport")[index];
  const transform = container.querySelectorAll(".preview-transform")[index];
  setReadOnlyNumberProperty(viewport, "clientWidth", viewportSize.width);
  setReadOnlyNumberProperty(viewport, "clientHeight", viewportSize.height);
  setReadOnlyNumberProperty(transform, "clientWidth", contentSize.width);
  setReadOnlyNumberProperty(transform, "clientHeight", contentSize.height);
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

it("keeps wheel zoom events inside preview frames", () => {
  const parentWheel = vi.fn();
  const { container } = render(
    <div onWheel={parentWheel}>
      <ComparisonPreview
        fullscreen={false}
        project={projectWithOneReviewCell}
        sourceImageUrl="blob:source-pattern"
        onFullscreenChange={vi.fn()}
        onSelectCell={vi.fn()}
      />
    </div>,
  );
  setPreviewSize(container, 0, { width: 400, height: 200 });

  fireEvent.wheel(container.querySelectorAll(".preview-viewport")[0], {
    deltaY: -100,
  });

  expect(parentWheel).not.toHaveBeenCalled();
  expect(screen.getByLabelText("识别叠加视图 缩放比例")).toHaveTextContent("125%");
});

it("configures target color statistics sorting from preview settings", async () => {
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
  renderPreview(projectWithUnevenStats);

  const statCodes = () =>
    Array.from(
      screen
        .getByLabelText("COCO 色块统计")
        .querySelectorAll<HTMLElement>(".target-color-stat strong"),
    ).map((element) => element.textContent);

  expect(statCodes()).toEqual(["A10", "B09", "K07"]);

  await userEvent.click(
    screen.getByRole("button", { name: "COCO 重绘预览 设置" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "按数量排序" }));
  await userEvent.click(screen.getByRole("button", { name: "倒序" }));

  expect(statCodes()).toEqual(["K07", "A10", "B09"]);
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

it("toggles target review overlays so correction frames do not cover colors", async () => {
  const { container } = renderPreview();

  expect(container.querySelectorAll(".grid-preview .review-cell")).toHaveLength(1);

  await userEvent.click(
    screen.getByRole("button", { name: "COCO 重绘预览 隐藏叠加" }),
  );

  expect(container.querySelectorAll(".grid-preview .review-cell")).toHaveLength(0);
  expect(
    screen.getByRole("button", { name: "COCO 重绘预览 显示叠加" }),
  ).toBeInTheDocument();
});

it("focuses a requested cell in both previews", () => {
  const { container, rerender } = renderPreview();
  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);
  setPreviewSize(container, 0, { width: 640, height: 320 });
  setPreviewSize(container, 1, { width: 520, height: 260 });

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

  expect(transforms(container)[0]).toBe("translate(16px, 0px) scale(1)");
  expect(transforms(container)[1]).toBe("translate(26px, 0px) scale(1)");
  expect(container.querySelectorAll(".focused-cell")).toHaveLength(2);
});


it("centers a located cell against the visually constrained preview height", () => {
  const tallSourceProject: BeadProject = {
    ...projectWithOneReviewCell,
    grid: {
      ...projectWithOneReviewCell.grid,
      bounds: [0, 0, 1440, 1499],
      x_lines: [0, 720, 1440],
      y_lines: [0, 1499],
    },
  };
  const { container, rerender } = renderPreview(tallSourceProject);
  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 1440 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 1499 });
  fireEvent.load(sourceImage);
  setPreviewSize(container, 0, { width: 900, height: 900 });
  setPreviewSize(container, 1, { width: 900, height: 900 });

  rerender(
    <ComparisonPreview
      fullscreen={false}
      focusRequest={{ cell: tallSourceProject.cells[0], nonce: 3 }}
      project={tallSourceProject}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={vi.fn()}
      onSelectCell={vi.fn()}
    />,
  );

  expect(transforms(container)[0]).toBe("translate(114px, 0px) scale(1)");
  expect(transforms(container)[1]).toBe("translate(26px, 0px) scale(1)");
});

it("keeps each preview zoom while centering the located review cell", async () => {
  const { container, rerender } = renderPreview();
  setPreviewSize(container, 0, { width: 400, height: 240 }, { width: 400, height: 200 });
  setPreviewSize(container, 1, { width: 500, height: 260 }, { width: 500, height: 250 });
  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);

  const zoomIn = screen.getByRole("button", { name: "识别叠加视图 放大" });
  await userEvent.click(zoomIn);
  await userEvent.click(zoomIn);
  await userEvent.click(zoomIn);
  await userEvent.click(screen.getByRole("button", { name: "COCO 重绘预览 放大" }));

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
  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("125%");
  expect(transforms(container)[0]).toBe("translate(4px, -12px) scale(1.75)");
  expect(transforms(container)[1]).toBe("translate(20px, -6px) scale(1.25)");
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
