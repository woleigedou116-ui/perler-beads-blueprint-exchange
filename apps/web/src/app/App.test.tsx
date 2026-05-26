import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("introduces the local converter", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "拼豆图纸标准转换" }),
    ).toBeInTheDocument();
    expect(screen.getByText("图片与项目文件仅在本机处理")).toBeInTheDocument();
  });
});
