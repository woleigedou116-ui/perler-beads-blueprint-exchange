import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ExportActions } from "./ExportActions";

it("uses shared buttons for legacy export actions while preserving export choices", async () => {
  const onExport = vi.fn();
  render(<ExportActions onExport={onExport} />);

  expect(screen.getByRole("button", { name: "保存项目" })).toHaveClass("ui-button");
  expect(screen.getByRole("button", { name: "导出图纸" })).toHaveClass("ui-button");
  expect(screen.getByRole("button", { name: "导出检查图" })).toHaveClass("ui-button");
  expect(screen.getByRole("button", { name: "导出清单" })).toHaveClass("ui-button");

  await userEvent.click(screen.getByRole("button", { name: "导出图纸" }));
  expect(onExport).toHaveBeenCalledWith("clean.png", { includeColorStats: true });

  await userEvent.click(screen.getByLabelText("导出时附带色块统计"));
  await userEvent.click(screen.getByRole("button", { name: "导出检查图" }));
  expect(onExport).toHaveBeenLastCalledWith("overlay.png", {
    includeColorStats: false,
  });
});
