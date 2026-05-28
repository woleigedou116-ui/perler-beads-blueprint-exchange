import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { GridPreview } from "./GridPreview";
import { projectWithOneReviewCell } from "./test-data";

it("overlays review cells on the uploaded source image within a shared transform", () => {
  const { container } = render(
    <GridPreview
      project={projectWithOneReviewCell}
      sourceImageUrl="blob:source-pattern"
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
  expect(container.querySelector(".preview-transform")).toHaveStyle({
    transform: "translate(8px, -4px) scale(1.25)",
  });
});
