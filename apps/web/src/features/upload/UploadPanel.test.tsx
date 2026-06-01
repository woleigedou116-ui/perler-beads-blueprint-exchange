import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { UploadPanel } from "./UploadPanel";

const patternFile = new File(["pattern"], "pattern.png", { type: "image/png" });
const noop = () => undefined;

function renderPanel(processing = false, onImport = noop) {
  render(
    <UploadPanel
      attribution=""
      file={patternFile}
      lastRecognitionDurationMs={null}
      previewUrl={null}
      processing={processing}
      project={null}
      onAttributionChange={noop}
      onImport={onImport}
      onOpenProject={noop}
      onSaveAttribution={noop}
      onSelectFile={noop}
    />,
  );
}

function renderPanelWithTiming() {
  render(
    <UploadPanel
      attribution=""
      file={patternFile}
      lastRecognitionDurationMs={6200}
      lastRecognitionTiming={{
        totalMs: 5800,
        readMs: 1,
        decodeMs: 10,
        ocrInitMs: 0,
        recognizeMs: 5760,
        ocrMs: 3900,
        ocrReps: 9,
        ocrEngineCalls: 9,
        ocrEngineMaxMs: 620,
        saveMs: 12,
      }}
      previewUrl={null}
      processing={false}
      project={null}
      onAttributionChange={noop}
      onImport={noop}
      onOpenProject={noop}
      onSaveAttribution={noop}
      onSelectFile={noop}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("shows project inputs and local processing status", () => {
  renderPanel();

  expect(screen.getByRole("region", { name: "项目与输入" })).toBeInTheDocument();
  expect(screen.getByLabelText("上传图纸")).toBeInTheDocument();
  expect(screen.getByLabelText("打开项目")).toBeInTheDocument();
  expect(screen.getByText("本地处理")).toBeInTheDocument();
});

it("updates elapsed recognition time inside the upload panel", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  renderPanel(true);

  expect(await screen.findByText("正在识别图纸")).toBeInTheDocument();
  expect(screen.getByText("已用时 0.0 秒")).toBeInTheDocument();

  vi.advanceTimersByTime(2400);

  expect(await screen.findByText("已用时 2.4 秒")).toBeInTheDocument();
});

it("ignores duplicate import clicks before the parent processing state updates", async () => {
  const onImport = vi.fn();

  renderPanel(false, onImport);

  const importButton = screen.getByRole("button", { name: "开始识别" });
  await userEvent.click(importButton);
  await userEvent.click(importButton);

  expect(onImport).toHaveBeenCalledTimes(1);
});

it("shows OCR representative cell diagnostics after recognition", () => {
  renderPanelWithTiming();

  expect(screen.getByText("OCR代表格")).toBeInTheDocument();
  expect(screen.getByText("9 格")).toBeInTheDocument();
  expect(screen.getByText("OCR调用耗时")).toBeInTheDocument();
  expect(screen.getByText("3.9 秒")).toBeInTheDocument();
  expect(screen.getByText("OCR最慢单次")).toBeInTheDocument();
  expect(screen.getByText("0.6 秒")).toBeInTheDocument();
});
