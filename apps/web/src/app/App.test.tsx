import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("opens directly to the workbench", () => {
    window.history.replaceState(null, "", "/");
    render(<App />);

    expect(screen.getByLabelText("拼豆转换工作台")).toBeInTheDocument();
    expect(screen.queryByText("图片与项目文件仅在本机处理")).not.toBeInTheDocument();
  });

  it("can open the desktop UI prototype without replacing the default workbench", () => {
    window.history.replaceState(null, "", "/?prototype=desktop-ui");
    render(<App />);

    expect(screen.getByLabelText("桌面工作台视觉模型")).toBeInTheDocument();
    expect(screen.getByText("图纸校对")).toBeInTheDocument();
  });
});
