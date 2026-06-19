/// <reference types="vite/client" />

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
import { afterEach, expect, it, vi } from "vitest";

import appStyles from "../../styles/app.css?inline";
import type { BeadProject } from "../../domain/types";
import { ComparisonPreview } from "./ComparisonPreview";
import { projectWithOneReviewCell } from "./test-data";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  pointer: { pointerId: number; clientX?: number; clientY?: number; pointerType?: string },
) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    clientX: { value: pointer.clientX ?? 0 },
    clientY: { value: pointer.clientY ?? 0 },
    pointerId: { value: pointer.pointerId },
    pointerType: { value: pointer.pointerType ?? "mouse" },
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

function cssBlockFor(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = appStyles.match(
    new RegExp(`(?:^|})\\s*${escapedSelector}\\s*\\{([^}]+)\\}`, "m"),
  );
  return match?.[1] ?? "";
}

it("applies zoom and panning independently for each blueprint preview", async () => {
  const { container } = renderPreview();
  setPreviewSize(container, 0, { width: 400, height: 200 });
  setPreviewSize(container, 1, { width: 400, height: 200 });

  expect(screen.getByRole("button", { name: "全屏查看" })).toHaveClass("ui-button");
  expect(screen.getByRole("button", { name: "识别叠加视图 缩小" })).toHaveClass(
    "ui-button",
  );
  expect(screen.getByRole("button", { name: "识别叠加视图 放大" })).toHaveClass(
    "ui-button",
  );
  expect(screen.getByRole("button", { name: "COCO 重绘预览 隐藏色号" })).toHaveClass(
    "ui-button",
  );

  await userEvent.click(screen.getByRole("button", { name: "识别叠加视图 放大" }));

  expect(screen.getByLabelText("识别叠加视图 缩放比例")).toHaveTextContent("125%");
  expect(transforms(container)).toEqual([
    "translate(-50px, -25px) scale(1.25)",
    "translate(0px, 0px) scale(1)",
  ]);

  fireEvent.wheel(container.querySelectorAll(".preview-viewport")[1], {
    deltaY: -100,
  });

  await vi.waitFor(() =>
    expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("125%"),
  );
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

it("keeps wheel zoom events inside preview frames", async () => {
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
  await vi.waitFor(() =>
    expect(screen.getByLabelText("识别叠加视图 缩放比例")).toHaveTextContent("125%"),
  );
});

it("uses caller-provided target color statistics sorting", () => {
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
  render(
    <ComparisonPreview
      colorStatSort={{ sortBy: "count", sortDirection: "desc" }}
      fullscreen={false}
      project={projectWithUnevenStats}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={vi.fn()}
      onSelectCell={vi.fn()}
    />,
  );

  const statCodes =
    Array.from(
      screen
        .getByLabelText("COCO 色块统计")
        .querySelectorAll<HTMLElement>(".target-color-stat strong"),
    ).map((element) => element.textContent);

  expect(statCodes).toEqual(["K07", "A10", "B09"]);
  expect(screen.queryByRole("button", { name: "COCO 重绘预览 设置" })).not.toBeInTheDocument();
});

it("uses desktop workspace preview rules without nested decorative cards", () => {
  renderPreview();

  expect(appStyles).toContain(".preview-row");
  expect(cssBlockFor(".preview-row")).toContain(
    "grid-template-rows: auto minmax(350px, auto) auto;",
  );
  expect(cssBlockFor(".center-workspace")).toContain("background: #ffffff;");
  expect(cssBlockFor(".center-workspace")).toContain("border: 1px solid #d9dfdc;");
  expect(cssBlockFor(".center-workspace")).toContain("border-radius: 8px;");
  expect(cssBlockFor(".center-workspace")).toContain("gap: 0.75rem;");
  expect(cssBlockFor(".center-workspace")).toContain("min-height: 0;");
  expect(cssBlockFor(".center-workspace")).toContain("padding: 0.75rem;");
  expect(cssBlockFor(".comparison-toolbar")).toContain("border-bottom: 1px solid #e2e7e4;");
  expect(cssBlockFor(".comparison-toolbar")).toContain("min-height: 2.4rem;");
  expect(cssBlockFor(".comparison-toolbar")).toContain("padding-bottom: 0.5rem;");
  expect(cssBlockFor(".preview-card")).toContain("display: grid;");
  expect(cssBlockFor(".preview-card")).toContain("grid-row: span 3;");
  expect(cssBlockFor(".preview-card")).toContain("grid-template-rows: subgrid;");
  expect(cssBlockFor(".preview-card")).toContain("border: 1px solid #dfe5e2;");
  expect(cssBlockFor(".preview-card")).toContain("border-radius: 8px;");
  expect(cssBlockFor(".preview-card")).toContain("min-width: 0;");
  expect(cssBlockFor(".preview-card")).toContain("padding: 0.5rem;");
  expect(cssBlockFor(".preview-card-header")).toContain("grid-row: 1;");
  expect(cssBlockFor(".preview-viewport")).toContain("grid-row: 2;");
  expect(cssBlockFor(".preview-viewport")).toContain("margin-top: 0;");
  expect(cssBlockFor(".preview-viewport")).toContain("background: #f7f8f6;");
  expect(cssBlockFor(".preview-viewport")).toContain("border: 1px solid #e0e5e2;");
  expect(cssBlockFor(".preview-viewport")).toContain("border-radius: 6px;");
  expect(cssBlockFor(".preview-viewport")).toContain("min-height: 360px;");
  expect(cssBlockFor(".preview-transform")).not.toContain("will-change:");
  expect(cssBlockFor(".preview-viewport.is-interacting .preview-transform")).toContain(
    "will-change: transform;",
  );
  expect(cssBlockFor(".target-color-stats")).toContain("grid-row: 3;");
  expect(cssBlockFor(".comparison-toolbar-actions")).toContain("margin-left: auto;");
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

it("toggles target cell labels for a finished-look preview", async () => {
  const { container } = renderPreview();

  expect(container.querySelectorAll(".grid-preview text")).toHaveLength(2);

  await userEvent.click(screen.getByRole("button", { name: "COCO 重绘预览 隐藏色号" }));

  expect(container.querySelectorAll(".grid-preview text")).toHaveLength(0);
  expect(container.querySelectorAll(".grid-preview rect")).toHaveLength(2);
  expect(
    screen.getByRole("button", { name: "COCO 重绘预览 显示色号" }),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "COCO 重绘预览 显示色号" }));

  expect(container.querySelectorAll(".grid-preview text")).toHaveLength(2);
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

it("allows panning clipped previews even at base zoom", () => {
  const { container } = renderPreview();
  setPreviewSize(container, 1, { width: 400, height: 240 }, { width: 400, height: 475 });

  const targetViewport = container.querySelectorAll(".preview-viewport")[1];
  firePointer(targetViewport, "pointerdown", { pointerId: 9, clientX: 50, clientY: 50 });
  firePointer(targetViewport, "pointermove", { pointerId: 9, clientX: 50, clientY: 10 });
  firePointer(targetViewport, "pointerup", { pointerId: 9 });

  expect(transforms(container)[1]).toBe("translate(0px, -40px) scale(1)");
});

it("recenters both previews when a different recognized project loads", () => {
  const { container, rerender } = renderPreview();
  setPreviewSize(container, 0, { width: 400, height: 240 }, { width: 400, height: 475 });
  setPreviewSize(container, 1, { width: 400, height: 240 }, { width: 400, height: 475 });

  const sourceViewport = container.querySelectorAll(".preview-viewport")[0];
  const targetViewport = container.querySelectorAll(".preview-viewport")[1];
  firePointer(sourceViewport, "pointerdown", {
    pointerId: 11,
    clientX: 50,
    clientY: 50,
  });
  firePointer(sourceViewport, "pointermove", {
    pointerId: 11,
    clientX: 40,
    clientY: 10,
  });
  firePointer(sourceViewport, "pointerup", { pointerId: 11 });
  firePointer(targetViewport, "pointerdown", {
    pointerId: 12,
    clientX: 50,
    clientY: 50,
  });
  firePointer(targetViewport, "pointermove", {
    pointerId: 12,
    clientX: 70,
    clientY: 20,
  });
  firePointer(targetViewport, "pointerup", { pointerId: 12 });

  expect(transforms(container)).toEqual([
    "translate(-10px, -40px) scale(1)",
    "translate(20px, -30px) scale(1)",
  ]);

  rerender(
    <ComparisonPreview
      fullscreen={false}
      project={{ ...projectWithOneReviewCell, id: "pattern-2" }}
      sourceImageUrl="blob:next-pattern"
      onFullscreenChange={vi.fn()}
      onSelectCell={vi.fn()}
    />,
  );

  expect(screen.getByLabelText("识别叠加视图 缩放比例")).toHaveTextContent("100%");
  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("100%");
  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1)",
    "translate(0px, 0px) scale(1)",
  ]);
});

it("updates pan transform during drag without committing a React render", () => {
  const commits: string[] = [];
  const queuedFrames: FrameRequestCallback[] = [];
  const requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
  const cancelAnimationFrameSpy = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation(() => undefined);
  const { container } = render(
    <Profiler id="comparison-preview" onRender={() => commits.push("commit")}>
      <ComparisonPreview
        fullscreen={false}
        project={projectWithOneReviewCell}
        sourceImageUrl="blob:source-pattern"
        onFullscreenChange={vi.fn()}
        onSelectCell={vi.fn()}
      />
    </Profiler>,
  );
  setPreviewSize(container, 1, { width: 400, height: 240 }, { width: 400, height: 475 });

  const targetViewport = container.querySelectorAll(".preview-viewport")[1];
  const targetTransform = container.querySelectorAll<HTMLElement>(".preview-transform")[1];

  firePointer(targetViewport, "pointerdown", { pointerId: 10, clientX: 50, clientY: 50 });
  const commitsAfterPointerDown = commits.length;
  firePointer(targetViewport, "pointermove", { pointerId: 10, clientX: 50, clientY: 15 });
  firePointer(targetViewport, "pointermove", { pointerId: 10, clientX: 50, clientY: 12 });

  expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
  expect(targetTransform.style.transform).toBe("translate(0px, 0px) scale(1)");
  expect(commits.length).toBe(commitsAfterPointerDown);

  queuedFrames.shift()?.(16);

  expect(targetTransform.style.transform).toBe("translate(0px, -38px) scale(1)");

  firePointer(targetViewport, "pointerup", { pointerId: 10 });

  expect(transforms(container)[1]).toBe("translate(0px, -38px) scale(1)");

  requestAnimationFrameSpy.mockRestore();
  cancelAnimationFrameSpy.mockRestore();
});

it("updates wheel zoom through a single animation frame before committing state", async () => {
  vi.useFakeTimers();
  const commits: string[] = [];
  const queuedFrames: FrameRequestCallback[] = [];
  const requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
  const cancelAnimationFrameSpy = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation(() => undefined);
  const { container } = render(
    <Profiler id="comparison-preview" onRender={() => commits.push("commit")}>
      <ComparisonPreview
        fullscreen={false}
        project={projectWithOneReviewCell}
        sourceImageUrl="blob:source-pattern"
        onFullscreenChange={vi.fn()}
        onSelectCell={vi.fn()}
      />
    </Profiler>,
  );
  setPreviewSize(container, 1, { width: 400, height: 200 }, { width: 400, height: 200 });

  const targetViewport = container.querySelectorAll(".preview-viewport")[1];
  const targetTransform = container.querySelectorAll<HTMLElement>(".preview-transform")[1];
  const commitsBeforeWheel = commits.length;

  fireEvent.wheel(targetViewport, { deltaY: -100 });
  fireEvent.wheel(targetViewport, { deltaY: -100 });

  expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("100%");
  const commitsBeforeFrame = commits.length;

  queuedFrames.shift()?.(16);

  expect(targetTransform.style.transform).toBe("translate(-100px, -50px) scale(1.5)");
  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("100%");
  expect(commits.length).toBe(commitsBeforeFrame);
  expect(commits.length - commitsBeforeWheel).toBeLessThanOrEqual(3);

  vi.advanceTimersByTime(149);
  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("100%");

  vi.advanceTimersByTime(1);
  await vi.waitFor(() =>
    expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("150%"),
  );
  expect(transforms(container)[1]).toBe("translate(-100px, -50px) scale(1.5)");

  requestAnimationFrameSpy.mockRestore();
  cancelAnimationFrameSpy.mockRestore();
});

it("updates touch pinch zoom through the same deferred transform path", async () => {
  vi.useFakeTimers();
  const queuedFrames: FrameRequestCallback[] = [];
  const requestAnimationFrameSpy = vi
    .spyOn(window, "requestAnimationFrame")
    .mockImplementation((callback) => {
      queuedFrames.push(callback);
      return queuedFrames.length;
    });
  const cancelAnimationFrameSpy = vi
    .spyOn(window, "cancelAnimationFrame")
    .mockImplementation(() => undefined);
  const { container } = renderPreview();
  setPreviewSize(container, 1, { width: 400, height: 200 }, { width: 400, height: 200 });

  const targetViewport = container.querySelectorAll(".preview-viewport")[1];
  const targetTransform = container.querySelectorAll<HTMLElement>(".preview-transform")[1];
  firePointer(targetViewport, "pointerdown", {
    pointerId: 21,
    pointerType: "touch",
    clientX: 150,
    clientY: 100,
  });
  firePointer(targetViewport, "pointerdown", {
    pointerId: 22,
    pointerType: "touch",
    clientX: 250,
    clientY: 100,
  });
  firePointer(targetViewport, "pointermove", {
    pointerId: 22,
    pointerType: "touch",
    clientX: 300,
    clientY: 100,
  });

  expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
  queuedFrames.shift()?.(16);

  expect(targetTransform.style.transform).toBe("translate(-100px, -50px) scale(1.5)");
  expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("100%");

  firePointer(targetViewport, "pointerup", { pointerId: 21, pointerType: "touch" });
  firePointer(targetViewport, "pointerup", { pointerId: 22, pointerType: "touch" });
  vi.advanceTimersByTime(150);
  await vi.waitFor(() =>
    expect(screen.getByLabelText("COCO 重绘预览 缩放比例")).toHaveTextContent("150%"),
  );

  requestAnimationFrameSpy.mockRestore();
  cancelAnimationFrameSpy.mockRestore();
});

it("selects a source cell from pointer release after zoom enables panning", async () => {
  const onSelectCell = vi.fn();
  const { container } = render(
    <ComparisonPreview
      fullscreen={false}
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
      onFullscreenChange={vi.fn()}
      onSelectCell={onSelectCell}
    />,
  );
  setPreviewSize(container, 0, { width: 400, height: 240 }, { width: 400, height: 200 });
  const sourceImage = screen.getByAltText("上传原图");
  Object.defineProperty(sourceImage, "naturalWidth", { configurable: true, value: 64 });
  Object.defineProperty(sourceImage, "naturalHeight", { configurable: true, value: 32 });
  fireEvent.load(sourceImage);
  await userEvent.click(screen.getByRole("button", { name: "识别叠加视图 放大" }));

  const sourceHitCell = screen.getByLabelText("原图格子选择层").querySelectorAll("rect")[1];
  const sourceViewport = container.querySelectorAll(".preview-viewport")[0];
  firePointer(sourceHitCell, "pointerdown", {
    pointerId: 8,
    clientX: 120,
    clientY: 80,
  });
  firePointer(sourceViewport, "pointerup", {
    pointerId: 8,
    clientX: 120,
    clientY: 80,
  });

  expect(onSelectCell).toHaveBeenCalledWith(projectWithOneReviewCell.cells[1]);
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
