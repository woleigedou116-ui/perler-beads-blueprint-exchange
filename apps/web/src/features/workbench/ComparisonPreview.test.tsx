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

it("applies button and wheel zoom to both blueprint previews", async () => {
  const { container } = renderPreview();

  await userEvent.click(screen.getByRole("button", { name: "放大" }));

  expect(screen.getByText("125%")).toBeInTheDocument();
  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1.25)",
    "translate(0px, 0px) scale(1.25)",
  ]);

  fireEvent.wheel(container.querySelectorAll(".preview-viewport")[0], {
    deltaY: -100,
  });

  expect(screen.getByText("150%")).toBeInTheDocument();
  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1.5)",
    "translate(0px, 0px) scale(1.5)",
  ]);
});

it("synchronizes panning and resets the viewport to fit", async () => {
  const { container } = renderPreview();
  await userEvent.click(screen.getByRole("button", { name: "放大" }));

  const firstViewport = container.querySelectorAll(".preview-viewport")[0];
  firePointer(firstViewport, "pointerdown", { pointerId: 1, clientX: 10, clientY: 20 });
  firePointer(firstViewport, "pointermove", { pointerId: 1, clientX: 34, clientY: 36 });
  firePointer(firstViewport, "pointerup", { pointerId: 1 });

  expect(transforms(container)).toEqual([
    "translate(24px, 16px) scale(1.25)",
    "translate(24px, 16px) scale(1.25)",
  ]);

  await userEvent.click(screen.getByRole("button", { name: "缩小" }));

  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1)",
    "translate(0px, 0px) scale(1)",
  ]);

  await userEvent.click(screen.getByRole("button", { name: "放大" }));
  firePointer(firstViewport, "pointerdown", { pointerId: 2, clientX: 10, clientY: 20 });
  firePointer(firstViewport, "pointermove", { pointerId: 2, clientX: 34, clientY: 36 });
  firePointer(firstViewport, "pointerup", { pointerId: 2 });

  await userEvent.click(screen.getByRole("button", { name: "适应窗口" }));

  expect(screen.getByText("100%")).toBeInTheDocument();
  expect(transforms(container)).toEqual([
    "translate(0px, 0px) scale(1)",
    "translate(0px, 0px) scale(1)",
  ]);
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
