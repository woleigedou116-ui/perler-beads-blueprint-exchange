import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WorkbenchStatusBar } from "./WorkbenchStatusBar";
import { projectWithOneReviewCell } from "./test-data";

describe("WorkbenchStatusBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows an empty project state", () => {
    render(
      <WorkbenchStatusBar
        project={null}
        reviewCount={0}
        selectedCell={null}
        lastRecognitionDurationMs={null}
      />,
    );

    expect(screen.getByRole("contentinfo")).toHaveTextContent("未加载项目");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("等待导入");
  });

  it("summarizes the loaded project", () => {
    render(
      <WorkbenchStatusBar
        project={projectWithOneReviewCell}
        reviewCount={1}
        selectedCell={projectWithOneReviewCell.cells[0]}
        lastRecognitionDurationMs={2400}
      />,
    );

    expect(screen.getByRole("contentinfo")).toHaveTextContent("网格 1 x 2");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("待确认 1");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("选中 1, 1");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("识别 2.4 秒");
  });
});
