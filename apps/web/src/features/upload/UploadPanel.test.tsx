import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { UploadPanel } from "./UploadPanel";

const patternFile = new File(["pattern"], "pattern.png", { type: "image/png" });
const noop = () => undefined;

function renderPanel(processing = false) {
  render(
    <UploadPanel
      attribution=""
      file={patternFile}
      lastRecognitionDurationMs={null}
      previewUrl={null}
      processing={processing}
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
  vi.useRealTimers();
});

it("updates elapsed recognition time inside the upload panel", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  renderPanel(true);

  expect(await screen.findByText("正在识别图纸")).toBeInTheDocument();
  expect(screen.getByText("已用时 0.0 秒")).toBeInTheDocument();

  vi.advanceTimersByTime(2400);

  expect(await screen.findByText("已用时 2.4 秒")).toBeInTheDocument();
});
