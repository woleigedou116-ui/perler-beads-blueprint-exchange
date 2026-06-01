import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("opens directly to the workbench", () => {
    render(<App />);

    expect(screen.getByLabelText("拼豆转换工作台")).toBeInTheDocument();
    expect(screen.queryByText("图片与项目文件仅在本机处理")).not.toBeInTheDocument();
  });
});
