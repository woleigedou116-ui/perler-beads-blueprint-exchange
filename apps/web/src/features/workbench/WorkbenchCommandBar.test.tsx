import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkbenchCommandBar } from "./WorkbenchCommandBar";

describe("WorkbenchCommandBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes desktop-style project commands", async () => {
    const onSelectImage = vi.fn();
    const onOpenProject = vi.fn();
    render(
      <WorkbenchCommandBar
        projectLoaded={false}
        reviewCount={0}
        onExportClean={() => undefined}
        onExportMapping={() => undefined}
        onExportOverlay={() => undefined}
        onSaveProject={() => undefined}
        onOpenProject={onOpenProject}
        onSelectImage={onSelectImage}
      />,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("拼豆图纸转换工具")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导入图片" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "打开项目" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "保存项目" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "导出图纸" })).toBeDisabled();

    await userEvent.upload(
      screen.getByLabelText("从命令栏导入图片"),
      new File(["image"], "pattern.png", { type: "image/png" }),
    );
    expect(onSelectImage).toHaveBeenCalledWith(expect.any(File));

    await userEvent.upload(
      screen.getByLabelText("从命令栏打开项目"),
      new File(["project"], "pattern.beadproject"),
    );
    expect(onOpenProject).toHaveBeenCalledWith(expect.any(File));
  });

  it("enables export commands when a project is loaded", async () => {
    const onExportClean = vi.fn();
    const onSaveProject = vi.fn();
    render(
      <WorkbenchCommandBar
        projectLoaded={true}
        reviewCount={3}
        onExportClean={onExportClean}
        onExportMapping={() => undefined}
        onExportOverlay={() => undefined}
        onSaveProject={onSaveProject}
        onOpenProject={() => undefined}
        onSelectImage={() => undefined}
      />,
    );

    expect(screen.getByText("待确认 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "保存项目" }));
    await userEvent.click(screen.getByRole("button", { name: "导出图纸" }));

    expect(onSaveProject).toHaveBeenCalledOnce();
    expect(onExportClean).toHaveBeenCalledOnce();
  });
});
