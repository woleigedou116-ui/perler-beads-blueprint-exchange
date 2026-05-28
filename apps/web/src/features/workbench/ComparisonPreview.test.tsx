import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

it("applies zoom and panning independently for each blueprint preview", async () => {
  const { container } = renderPreview();

  await userEvent.click(screen.getByRole("button", { name: "识别叠加视图 放大" }));

  expect(screen.getByText("识别叠加视图 125%")).toBeInTheDocument();
  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1.25)",
    "translate(0px, 0px) scale(1)",
  ]);

  fireEvent.wheel(container.querySelectorAll(".preview-viewport")[1], {
    deltaY: -100,
  });

  expect(screen.getByText("COCO 重绘预览 125%")).toBeInTheDocument();
  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1.25)",
    "translate(0px, 0px) scale(1.25)",
  ]);

  const secondViewport = container.querySelectorAll(".preview-viewport")[1];
  firePointer(secondViewport, "pointerdown", { pointerId: 1, clientX: 10, clientY: 20 });
  firePointer(secondViewport, "pointermove", { pointerId: 1, clientX: 34, clientY: 36 });
  firePointer(secondViewport, "pointerup", { pointerId: 1 });

  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1.25)",
    "translate(24px, 16px) scale(1.25)",
  ]);

  await userEvent.click(screen.getByRole("button", { name: "COCO 重绘预览 适应窗口" }));

  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1.25)",
    "translate(0px, 0px) scale(1)",
  ]);
});

it("toggles source review overlays without hiding the uploaded image", async () => {
  renderPreview();

  expect(screen.getByAltText("上传原图")).toHaveAttribute("src", "blob:source-pattern");
  expect(screen.getByLabelText("待复核标记叠加层")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "隐藏叠加" }));

  expect(screen.getByAltText("上传原图")).toBeInTheDocument();
  expect(screen.queryByLabelText("待复核标记叠加层")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "显示叠加" })).toBeInTheDocument();
});

it("focuses a requested cell in both previews", () => {
  const { container, rerender } = renderPreview();

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

  expect(transforms(container)[0]).toContain("scale(2)");
  expect(transforms(container)[1]).toContain("scale(2)");
  expect(container.querySelectorAll(".focused-cell")).toHaveLength(2);
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
