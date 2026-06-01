# Desktop Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current browser UI into a desktop-software-style workbench while keeping the existing React + FastAPI architecture.

**Architecture:** Keep `WorkbenchPage` as the state orchestrator, but split the visible shell into focused React components: command bar, project sidebar, center preview workspace, review sidebar, and status bar. Add a small browser-backed file action boundary so future pywebview/Electron integration can replace file behavior without rewriting the workbench.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, existing FastAPI client and browser File APIs.

---

## File Structure

- Create `apps/web/src/platform/fileActions.ts`
  - Owns browser-backed export saving. Keep this narrow for future native-shell replacement.
- Create `apps/web/src/platform/fileActions.test.ts`
  - Covers save picker and fallback download behavior moved from `api/exports.ts`.
- Modify `apps/web/src/api/exports.ts`
  - Re-export `saveExport` from `platform/fileActions` so existing imports continue working during the transition.
- Create `apps/web/src/features/workbench/WorkbenchCommandBar.tsx`
  - Renders desktop-style top commands and hidden file inputs for image/project selection.
- Create `apps/web/src/features/workbench/WorkbenchCommandBar.test.tsx`
  - Covers import/open controls and export command availability.
- Create `apps/web/src/features/workbench/WorkbenchStatusBar.tsx`
  - Renders global project status, grid size, review count, selected cell, and timing summary.
- Create `apps/web/src/features/workbench/WorkbenchStatusBar.test.tsx`
  - Covers empty and loaded project states.
- Modify `apps/web/src/app/App.tsx`
  - Remove web-page hero header and let `WorkbenchPage` render the software shell.
- Modify `apps/web/src/app/App.test.tsx`
  - Assert the application opens directly to the workbench.
- Modify `apps/web/src/features/upload/UploadPanel.tsx`
  - Recast as project/sidebar content while keeping existing aria labels for upload and open inputs.
- Modify `apps/web/src/features/upload/UploadPanel.test.tsx`
  - Update copy and structure expectations.
- Modify `apps/web/src/features/workbench/WorkbenchPage.tsx`
  - Compose command bar, sidebars, center workspace, and status bar. Keep current state and handler behavior.
- Modify `apps/web/src/features/workbench/WorkbenchPage.test.tsx`
  - Update layout tests and preserve existing behavior tests.
- Modify `apps/web/src/features/workbench/ComparisonPreview.tsx`
  - Tighten preview toolbar semantics and remove export placement from the preview toolbar.
- Modify `apps/web/src/features/workbench/ComparisonPreview.test.tsx`
  - Update toolbar expectations.
- Modify `apps/web/src/features/workbench/ExportActions.tsx`
  - Render compact command-bar export actions instead of preview-toolbar actions.
- Modify `apps/web/src/features/workbench/ReviewPanel.tsx`
  - Reorganize right sidebar into explicit queue, selected-cell, and tools sections.
- Modify `apps/web/src/features/workbench/ReviewPanel.test.tsx`
  - Assert the new section labels and existing actions.
- Modify `apps/web/src/features/workbench/PaletteReference.tsx`
  - Keep functionality, adjust trigger styling to fit a desktop toolbar/sidebar surface.
- Modify `apps/web/src/styles/app.css`
  - Replace web-page shell styling with desktop workbench layout and responsive rules.

## Task 1: File Action Boundary

**Files:**
- Create: `apps/web/src/platform/fileActions.ts`
- Create: `apps/web/src/platform/fileActions.test.ts`
- Modify: `apps/web/src/api/exports.ts`
- Modify: `apps/web/src/api/exports.test.ts`

- [ ] **Step 1: Write tests for the new platform file action boundary**

Create `apps/web/src/platform/fileActions.test.ts` with these tests:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveExport } from "./fileActions";

describe("fileActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("falls back to an anchor download when the save picker is unavailable", async () => {
    const click = vi.fn();
    const createElement = vi.spyOn(document, "createElement");
    createElement.mockReturnValue({
      click,
      href: "",
      download: "",
    } as unknown as HTMLAnchorElement);

    await saveExport("/api/export", "mapping.csv");

    const link = createElement.mock.results[0].value as HTMLAnchorElement;
    expect(link.href).toContain("/api/export");
    expect(link.download).toBe("mapping.csv");
    expect(click).toHaveBeenCalledOnce();
  });

  it("uses the browser save picker when available", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable });
    const blob = new Blob(["csv"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    vi.stubGlobal("showSaveFilePicker", showSaveFilePicker);

    await saveExport("/api/export", "mapping.csv");

    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "mapping.csv",
      types: [{ description: "CSV 表格", accept: { "text/csv": [".csv"] } }],
    });
    expect(write).toHaveBeenCalledWith(blob);
    expect(close).toHaveBeenCalledOnce();
  });

  it("ignores cancelled save picker dialogs", async () => {
    vi.stubGlobal(
      "showSaveFilePicker",
      vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
    );

    await expect(saveExport("/api/export", "clean.png")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```powershell
cd apps\web
npm test -- --run src/platform/fileActions.test.ts
```

Expected: FAIL because `src/platform/fileActions.ts` does not exist.

- [ ] **Step 3: Move the export saving implementation into the platform module**

Create `apps/web/src/platform/fileActions.ts`:

```ts
export type ExportKind =
  | "clean.png"
  | "overlay.png"
  | "mapping.csv"
  | "project.beadproject";

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
}

const EXPORT_TYPES: Record<ExportKind, SaveFilePickerOptions["types"]> = {
  "clean.png": [{ description: "PNG 图片", accept: { "image/png": [".png"] } }],
  "overlay.png": [{ description: "PNG 图片", accept: { "image/png": [".png"] } }],
  "mapping.csv": [{ description: "CSV 表格", accept: { "text/csv": [".csv"] } }],
  "project.beadproject": [
    {
      description: "拼豆项目",
      accept: { "application/octet-stream": [".beadproject"] },
    },
  ],
};

function supportsSavePicker(): boolean {
  return typeof (window as SavePickerWindow).showSaveFilePicker === "function";
}

function fallbackDownload(url: string, kind: ExportKind) {
  const link = document.createElement("a");
  link.href = url;
  link.download = kind;
  link.click();
}

export async function saveExport(url: string, kind: ExportKind): Promise<void> {
  if (!supportsSavePicker()) {
    fallbackDownload(url, kind);
    return;
  }

  try {
    const picker = (window as SavePickerWindow).showSaveFilePicker;
    if (!picker) {
      fallbackDownload(url, kind);
      return;
    }
    const handle = await picker({
      suggestedName: kind,
      types: EXPORT_TYPES[kind],
    });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("导出失败，请稍后重试");
    }
    const writable = await handle.createWritable();
    await writable.write(await response.blob());
    await writable.close();
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      return;
    }
    throw caught;
  }
}
```

Replace `apps/web/src/api/exports.ts` with:

```ts
export { saveExport, type ExportKind } from "../platform/fileActions";
```

- [ ] **Step 4: Keep the existing export tests passing**

If `apps/web/src/api/exports.test.ts` imports from `./exports`, keep the file as-is except update any type-only expectations to match the re-export. Do not duplicate the save picker tests in both locations.

Run:

```powershell
cd apps\web
npm test -- --run src/platform/fileActions.test.ts src/api/exports.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/web/src/platform/fileActions.ts apps/web/src/platform/fileActions.test.ts apps/web/src/api/exports.ts apps/web/src/api/exports.test.ts
git commit -m "refactor: isolate browser file actions"
```

## Task 2: Desktop Shell, Command Bar, and Status Bar

**Files:**
- Create: `apps/web/src/features/workbench/WorkbenchCommandBar.tsx`
- Create: `apps/web/src/features/workbench/WorkbenchCommandBar.test.tsx`
- Create: `apps/web/src/features/workbench/WorkbenchStatusBar.tsx`
- Create: `apps/web/src/features/workbench/WorkbenchStatusBar.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.test.tsx`

- [ ] **Step 1: Write command bar tests**

Create `apps/web/src/features/workbench/WorkbenchCommandBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WorkbenchCommandBar } from "./WorkbenchCommandBar";

describe("WorkbenchCommandBar", () => {
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
```

- [ ] **Step 2: Write status bar tests**

Create `apps/web/src/features/workbench/WorkbenchStatusBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkbenchStatusBar } from "./WorkbenchStatusBar";
import { projectWithOneReviewCell } from "./test-data";

describe("WorkbenchStatusBar", () => {
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
```

- [ ] **Step 3: Run the new tests to verify they fail**

```powershell
cd apps\web
npm test -- --run src/features/workbench/WorkbenchCommandBar.test.tsx src/features/workbench/WorkbenchStatusBar.test.tsx
```

Expected: FAIL because the two components do not exist.

- [ ] **Step 4: Implement `WorkbenchCommandBar`**

Create `apps/web/src/features/workbench/WorkbenchCommandBar.tsx`:

```tsx
interface WorkbenchCommandBarProps {
  projectLoaded: boolean;
  reviewCount: number;
  onExportClean: () => void;
  onExportMapping: () => void;
  onExportOverlay: () => void;
  onOpenProject: (file: File) => void;
  onSaveProject: () => void;
  onSelectImage: (file: File) => void;
}

export function WorkbenchCommandBar({
  projectLoaded,
  reviewCount,
  onExportClean,
  onExportMapping,
  onExportOverlay,
  onOpenProject,
  onSaveProject,
  onSelectImage,
}: WorkbenchCommandBarProps) {
  return (
    <header className="workbench-command-bar" role="banner">
      <div className="command-brand">
        <strong>拼豆图纸转换工具</strong>
        <span>MARD -&gt; COCO</span>
      </div>
      <nav aria-label="项目命令" className="command-group">
        <label className="command-file-button">
          导入图片
          <input
            aria-label="从命令栏导入图片"
            accept=".jpg,.jpeg,.png,.webp"
            type="file"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) {
                onSelectImage(selected);
              }
            }}
          />
        </label>
        <label className="command-file-button">
          打开项目
          <input
            aria-label="从命令栏打开项目"
            accept=".beadproject"
            type="file"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) {
                onOpenProject(selected);
              }
            }}
          />
        </label>
        <button disabled={!projectLoaded} type="button" onClick={onSaveProject}>
          保存项目
        </button>
      </nav>
      <nav aria-label="导出命令" className="command-group">
        <span className="command-review-count">待确认 {reviewCount}</span>
        <button disabled={!projectLoaded} type="button" onClick={onExportClean}>
          导出图纸
        </button>
        <button disabled={!projectLoaded} type="button" onClick={onExportOverlay}>
          导出检查图
        </button>
        <button disabled={!projectLoaded} type="button" onClick={onExportMapping}>
          导出清单
        </button>
      </nav>
    </header>
  );
}
```

- [ ] **Step 5: Implement `WorkbenchStatusBar`**

Create `apps/web/src/features/workbench/WorkbenchStatusBar.tsx`:

```tsx
import type { BeadProject, Cell } from "../../domain/types";

interface WorkbenchStatusBarProps {
  lastRecognitionDurationMs: number | null;
  project: BeadProject | null;
  reviewCount: number;
  selectedCell: Cell | null;
}

export function WorkbenchStatusBar({
  lastRecognitionDurationMs,
  project,
  reviewCount,
  selectedCell,
}: WorkbenchStatusBarProps) {
  return (
    <footer className="workbench-status-bar" role="contentinfo">
      <span>{project ? "项目已加载" : "未加载项目"}</span>
      <span>
        {project ? `网格 ${project.grid.rows} x ${project.grid.columns}` : "等待导入"}
      </span>
      <span>待确认 {reviewCount}</span>
      <span>
        {selectedCell
          ? `选中 ${selectedCell.row + 1}, ${selectedCell.column + 1}`
          : "未选中格子"}
      </span>
      <span>
        {lastRecognitionDurationMs !== null
          ? `识别 ${(lastRecognitionDurationMs / 1000).toFixed(1)} 秒`
          : "暂无识别耗时"}
      </span>
    </footer>
  );
}
```

- [ ] **Step 6: Compose the shell in `WorkbenchPage`**

In `apps/web/src/features/workbench/WorkbenchPage.tsx`, import the new components:

```ts
import { WorkbenchCommandBar } from "./WorkbenchCommandBar";
import { WorkbenchStatusBar } from "./WorkbenchStatusBar";
```

Replace the current top-level return with this structure while preserving existing handlers:

```tsx
return (
  <div
    aria-label="拼豆转换工作台"
    className={`desktop-workbench${isReviewFullscreen ? " review-fullscreen" : ""}`}
  >
    <WorkbenchCommandBar
      projectLoaded={Boolean(project)}
      reviewCount={reviewCount}
      onExportClean={() => handleExport("clean.png", { includeColorStats: true })}
      onExportMapping={() => handleExport("mapping.csv")}
      onExportOverlay={() => handleExport("overlay.png", { includeColorStats: true })}
      onOpenProject={handleOpenProject}
      onSaveProject={() => handleExport("project.beadproject")}
      onSelectImage={setFile}
    />
    <div className="workbench-body">
      {/* keep the existing UploadPanel, center workspace, and ReviewPanel children here */}
    </div>
    <WorkbenchStatusBar
      project={project}
      reviewCount={reviewCount}
      selectedCell={selectedCell}
      lastRecognitionDurationMs={lastRecognitionDurationMs}
    />
  </div>
);
```

Move the existing `<UploadPanel />`, center `<section />`, and review `<ReviewPanel />` into `.workbench-body`. Keep the old `aria-label="拼豆转换工作台"` for tests, but the class changes from `workbench` to `desktop-workbench`.

- [ ] **Step 7: Remove the web-page hero from `App`**

Replace `apps/web/src/app/App.tsx` with:

```tsx
import { WorkbenchPage } from "../features/workbench/WorkbenchPage";

export function App() {
  return (
    <main className="app-shell">
      <WorkbenchPage />
    </main>
  );
}
```

Update `apps/web/src/app/App.test.tsx` so it asserts:

```tsx
expect(screen.getByLabelText("拼豆转换工作台")).toBeInTheDocument();
expect(screen.queryByText("图片与项目文件仅在本机处理")).not.toBeInTheDocument();
```

- [ ] **Step 8: Run focused tests**

```powershell
cd apps\web
npm test -- --run src/features/workbench/WorkbenchCommandBar.test.tsx src/features/workbench/WorkbenchStatusBar.test.tsx src/app/App.test.tsx src/features/workbench/WorkbenchPage.test.tsx
```

Expected: PASS after updating any `workbench` class assertions to `desktop-workbench`.

- [ ] **Step 9: Commit**

```powershell
git add apps/web/src/features/workbench/WorkbenchCommandBar.tsx apps/web/src/features/workbench/WorkbenchCommandBar.test.tsx apps/web/src/features/workbench/WorkbenchStatusBar.tsx apps/web/src/features/workbench/WorkbenchStatusBar.test.tsx apps/web/src/app/App.tsx apps/web/src/app/App.test.tsx apps/web/src/features/workbench/WorkbenchPage.tsx apps/web/src/features/workbench/WorkbenchPage.test.tsx
git commit -m "feat: add desktop workbench shell"
```

## Task 3: Project Sidebar

**Files:**
- Modify: `apps/web/src/features/upload/UploadPanel.tsx`
- Modify: `apps/web/src/features/upload/UploadPanel.test.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] **Step 1: Write/adjust tests for project-sidebar behavior**

In `apps/web/src/features/upload/UploadPanel.test.tsx`, assert the panel still exposes existing inputs and now presents project status copy:

```tsx
expect(screen.getByRole("region", { name: "项目与输入" })).toBeInTheDocument();
expect(screen.getByLabelText("上传图纸")).toBeInTheDocument();
expect(screen.getByLabelText("打开项目")).toBeInTheDocument();
expect(screen.getByText("本地处理")).toBeInTheDocument();
```

In `WorkbenchPage.test.tsx`, keep existing selectors `上传图纸`, `打开项目`, `开始识别`, `本次识别用时`, and `识别耗时诊断`. These are behavioral anchors and must remain stable.

- [ ] **Step 2: Run focused tests to verify current mismatch**

```powershell
cd apps\web
npm test -- --run src/features/upload/UploadPanel.test.tsx src/features/workbench/WorkbenchPage.test.tsx
```

Expected: FAIL for the new `项目与输入` region and `本地处理` copy.

- [ ] **Step 3: Update `UploadPanel` markup without changing behavior**

Change the root section in `apps/web/src/features/upload/UploadPanel.tsx`:

```tsx
<section className="panel project-sidebar" aria-label="项目与输入">
  <div className="sidebar-section-heading">
    <h2>项目</h2>
    <span>本地处理</span>
  </div>
  {/* keep existing file field, preview, standards, import button, progress, diagnostics, open project, grid status, attribution */}
</section>
```

Keep all existing accessible labels:

- `上传图纸`
- `打开项目`
- `来源标准`
- `目标标准`
- `开始识别`
- `保存出处`
- `识别耗时诊断`

Do not change import timing state or `importSubmitted` logic in this task.

- [ ] **Step 4: Add project sidebar CSS**

In `apps/web/src/styles/app.css`, add the project-sidebar rules near the old upload-panel rules:

```css
.project-sidebar {
  min-width: 0;
}

.sidebar-section-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.sidebar-section-heading h2 {
  font-size: 0.95rem;
  margin: 0;
}

.sidebar-section-heading span {
  color: #5f6d69;
  font-size: 0.78rem;
}
```

Keep `.upload-preview`, `.upload-placeholder`, `.standards`, `.recognition-duration`, and `.recognition-timing` selectors unless a later visual pass replaces them.

- [ ] **Step 5: Run focused tests**

```powershell
cd apps\web
npm test -- --run src/features/upload/UploadPanel.test.tsx src/features/workbench/WorkbenchPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add apps/web/src/features/upload/UploadPanel.tsx apps/web/src/features/upload/UploadPanel.test.tsx apps/web/src/features/workbench/WorkbenchPage.test.tsx apps/web/src/styles/app.css
git commit -m "feat: reshape upload panel as project sidebar"
```

## Task 4: Center Preview Workspace and Export Placement

**Files:**
- Modify: `apps/web/src/features/workbench/WorkbenchPage.tsx`
- Modify: `apps/web/src/features/workbench/ComparisonPreview.tsx`
- Modify: `apps/web/src/features/workbench/ComparisonPreview.test.tsx`
- Modify: `apps/web/src/features/workbench/ExportActions.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] **Step 1: Adjust tests to make export placement explicit**

In `WorkbenchPage.test.tsx`, replace the old "moves export actions into the preview toolbar" test with a desktop command bar expectation:

```tsx
it("keeps export actions in the desktop command bar", async () => {
  await importPattern();

  const exportCommands = screen.getByRole("navigation", { name: "导出命令" });

  expect(within(exportCommands).getByRole("button", { name: "导出图纸" })).toBeEnabled();
  expect(within(exportCommands).getByRole("button", { name: "导出检查图" })).toBeEnabled();
  expect(within(exportCommands).getByRole("button", { name: "导出清单" })).toBeEnabled();
  expect(screen.getByLabelText("预览工具栏")).not.toHaveTextContent("导出图纸");
});
```

Update export behavior tests to click buttons inside `导出命令` instead of the preview toolbar.

- [ ] **Step 2: Run focused tests to verify the old placement fails**

```powershell
cd apps\web
npm test -- --run src/features/workbench/WorkbenchPage.test.tsx src/features/workbench/ComparisonPreview.test.tsx
```

Expected: FAIL until `toolbarActions={<ExportActions />}` is removed from `ComparisonPreview`.

- [ ] **Step 3: Remove export actions from `ComparisonPreview`**

In `WorkbenchPage.tsx`, change:

```tsx
toolbarActions={<ExportActions onExport={handleExport} />}
```

to:

```tsx
toolbarActions={null}
```

Then remove the `ExportActions` import if no longer used in `WorkbenchPage`.

Keep `ComparisonPreview`'s `toolbarActions?: ReactNode` prop for now. It can remain a generic extension point, but this UI no longer uses it for exports.

- [ ] **Step 4: Use command bar export handlers**

In the `WorkbenchCommandBar` usage, keep these mappings:

```tsx
onSaveProject={() => handleExport("project.beadproject")}
onExportClean={() => handleExport("clean.png", { includeColorStats: true })}
onExportOverlay={() => handleExport("overlay.png", { includeColorStats: true })}
onExportMapping={() => handleExport("mapping.csv")}
```

This intentionally defaults image exports to include color statistics. Do not add a new option in this task; reintroduce an export-options menu later only if users ask.

- [ ] **Step 5: Tighten preview workspace CSS**

In `app.css`, replace web-card-heavy preview styling with these desktop workspace rules:

```css
.center-workspace {
  background: #ffffff;
  border: 1px solid #d9dfdc;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 0;
  padding: 0.75rem;
}

.comparison-toolbar {
  align-items: center;
  border-bottom: 1px solid #e2e7e4;
  display: flex;
  min-height: 2.4rem;
  padding-bottom: 0.5rem;
}

.preview-card {
  border: 1px solid #dfe5e2;
  border-radius: 8px;
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid;
  min-width: 0;
  padding: 0.5rem;
}

.preview-viewport {
  background: #f7f8f6;
  border: 1px solid #e0e5e2;
  border-radius: 6px;
  min-height: 360px;
}
```

Ensure there is no nested card effect: `.center-workspace` is the framed tool; `.preview-card` is a functional preview frame, not a decorative card.

- [ ] **Step 6: Run preview tests**

```powershell
cd apps\web
npm test -- --run src/features/workbench/WorkbenchPage.test.tsx src/features/workbench/ComparisonPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/features/workbench/WorkbenchPage.tsx apps/web/src/features/workbench/ComparisonPreview.tsx apps/web/src/features/workbench/ComparisonPreview.test.tsx apps/web/src/features/workbench/ExportActions.tsx apps/web/src/features/workbench/WorkbenchPage.test.tsx apps/web/src/styles/app.css
git commit -m "feat: focus exports and previews for desktop workbench"
```

## Task 5: Review Sidebar Sections

**Files:**
- Modify: `apps/web/src/features/workbench/ReviewPanel.tsx`
- Modify: `apps/web/src/features/workbench/ReviewPanel.test.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] **Step 1: Write tests for explicit sidebar sections**

In `ReviewPanel.test.tsx`, add or update a test:

```tsx
expect(screen.getByRole("complementary", { name: "校对与属性" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "校对队列" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "选中格属性" })).toBeInTheDocument();
expect(screen.getByRole("region", { name: "非拼豆工具" })).toBeInTheDocument();
```

Keep existing tests for:

- `定位`
- `确认`
- `修改`
- `修正选中格`
- `标记为非拼豆`
- `框选非拼豆区域`
- `应用框选区域`
- `取消框选`

- [ ] **Step 2: Run review panel tests to verify section markup is missing**

```powershell
cd apps\web
npm test -- --run src/features/workbench/ReviewPanel.test.tsx src/features/workbench/WorkbenchPage.test.tsx
```

Expected: FAIL for the new `校对与属性` and section labels.

- [ ] **Step 3: Reorganize `ReviewPanel` markup**

Change the root element:

```tsx
<aside className="panel review-panel" aria-label="校对与属性">
```

Organize existing content into these sections without changing handlers:

```tsx
<section className="review-sidebar-section" aria-label="校对队列">
  {/* existing heading, settings, region-mode panel, review-list */}
</section>

<section className="review-sidebar-section" aria-label="选中格属性">
  {/* existing selected cell heading, source/target inputs, correction button, candidate controls */}
</section>

<section className="review-sidebar-section" aria-label="非拼豆工具">
  {/* mark selected cell unwanted and region controls */}
</section>
```

If the current `标记为非拼豆` button lives beside selected-cell controls, move only its markup into `非拼豆工具`; keep the `onMarkCellUnwanted(selectedCell)` behavior unchanged.

- [ ] **Step 4: Preserve selection and settings behavior**

Do not change these state variables or helper functions:

```ts
const [sourceCode, setSourceCode] = useState("");
const [targetCode, setTargetCode] = useState("");
const [candidateGroupKey, setCandidateGroupKey] = useState<string | null>(null);
const [expandedPaletteGroupKey, setExpandedPaletteGroupKey] = useState<string | null>(null);
const [showSettings, setShowSettings] = useState(false);
```

Do not change `nearestCandidates`, `handleCandidateClick`, `handleLocate`, or `handleSubmitCorrection`.

- [ ] **Step 5: Add review sidebar CSS**

Add or update:

```css
.review-panel {
  display: grid;
  gap: 0.75rem;
  grid-template-rows: minmax(180px, 1fr) auto auto;
  max-height: none;
  min-height: 0;
}

.review-sidebar-section {
  border: 1px solid #e2e7e4;
  border-radius: 8px;
  min-height: 0;
  padding: 0.65rem;
}

.review-sidebar-section[aria-label="校对队列"] {
  display: flex;
  flex-direction: column;
}

.review-list {
  min-height: 0;
  overflow-y: auto;
}
```

Keep review cards readable and do not hide candidate buttons.

- [ ] **Step 6: Run focused tests**

```powershell
cd apps\web
npm test -- --run src/features/workbench/ReviewPanel.test.tsx src/features/workbench/WorkbenchPage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/features/workbench/ReviewPanel.tsx apps/web/src/features/workbench/ReviewPanel.test.tsx apps/web/src/features/workbench/WorkbenchPage.test.tsx apps/web/src/styles/app.css
git commit -m "feat: organize review sidebar for desktop workflow"
```

## Task 6: Visual Polish, Responsiveness, and Verification

**Files:**
- Modify: `apps/web/src/styles/app.css`
- Modify: `apps/web/src/features/workbench/PaletteReference.tsx`
- Modify: `apps/web/src/features/workbench/PaletteReference.test.tsx`
- Modify: `docs/implementation-progress.md`

- [ ] **Step 1: Update visual shell CSS**

Replace the old page-shell styling with a desktop layout:

```css
:root {
  background: #eef1ef;
  color: #1f2b2c;
  font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
}

.app-shell {
  height: 100vh;
  min-height: 720px;
  padding: 0;
}

.desktop-workbench {
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr) 30px;
  height: 100vh;
  min-height: 720px;
}

.workbench-body {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 280px minmax(420px, 1fr) 320px;
  min-height: 0;
  padding: 0.75rem;
}

button,
.command-file-button {
  border-radius: 6px;
}

.panel,
.center-workspace {
  border-radius: 8px;
}
```

Remove or neutralize obsolete `.app-header`, `.eyebrow`, and `.local-note` styles once `App.tsx` no longer renders them.

- [ ] **Step 2: Add responsive behavior for narrower desktop windows**

Add:

```css
@media (max-width: 1180px) {
  .workbench-body {
    grid-template-columns: 250px minmax(360px, 1fr) 290px;
  }

  .command-brand span {
    display: none;
  }
}

@media (max-width: 1024px) {
  .desktop-workbench {
    min-width: 960px;
  }
}
```

This plan targets desktop software windows, so horizontal scrolling at very narrow widths is acceptable. Do not redesign for phones.

- [ ] **Step 3: Adjust palette reference trigger**

In `PaletteReference.tsx`, keep the button text `色号表` but make the trigger fit the desktop shell by class only:

```tsx
<div className="palette-reference desktop-palette-reference">
```

Add CSS:

```css
.desktop-palette-reference .palette-fab {
  border-radius: 6px;
  bottom: 42px;
  right: 1rem;
}
```

- [ ] **Step 4: Update implementation progress**

Append a short note to `docs/implementation-progress.md` under the active checkpoint:

```md
- Desktop-style UI redesign plan and implementation split were added on
  2026-06-01. The current implementation keeps the browser architecture but
  reshapes the frontend toward a reusable desktop workbench shell.
```

- [ ] **Step 5: Run full frontend verification**

```powershell
cd apps\web
npm test -- --run
npm run build
```

Expected:

- Vitest: all tests pass.
- Build: `tsc --noEmit && vite build` exits 0.

- [ ] **Step 6: Browser visual smoke check**

Start the local service from the worktree:

```powershell
$owner=(Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($owner) { Stop-Process -Id $owner -Force; Start-Sleep -Seconds 1 }
$env:PYTHONPATH='apps/api/src'
Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList @('-m','uvicorn','bead_converter.main:app','--host','127.0.0.1','--port','8787') -WorkingDirectory (Get-Location) -WindowStyle Hidden
Start-Sleep -Seconds 3
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health'
```

Open `http://127.0.0.1:8787/` and capture desktop screenshots at:

- 1366 x 768
- 1024 x 768

Manual checks:

- Top command bar is visible.
- Left project panel, center previews, right review panel, and bottom status bar are visible.
- No obvious text overlap.
- Export commands are in the command bar.
- Existing upload/open project controls remain reachable.

- [ ] **Step 7: Commit**

```powershell
git add apps/web/src/styles/app.css apps/web/src/features/workbench/PaletteReference.tsx apps/web/src/features/workbench/PaletteReference.test.tsx docs/implementation-progress.md
git commit -m "style: polish desktop workbench layout"
```

## Final Verification

Run from the worktree:

```powershell
.\.venv\Scripts\python.exe -m pytest
cd apps\web
npm test -- --run
npm run build
```

Expected:

- Backend tests pass.
- Frontend tests pass.
- Frontend build passes.

Then report:

- Final commit hash.
- Test counts.
- Build result.
- Browser smoke-check notes.

## Self-Review

Spec coverage:

- Desktop shell: Tasks 2 and 6.
- Left project sidebar: Task 3.
- Central preview workspace: Task 4.
- Right review/attribute sidebar: Task 5.
- Bottom status bar: Task 2.
- File action boundary for future native shell: Task 1.
- No algorithm, project format, export format, or native shell changes: enforced in task scopes.

Placeholder scan:

- No placeholder markers or vague catch-all implementation steps are used.

Type consistency:

- `ExportKind` remains the same string union.
- `saveExport(url, kind)` remains the public API.
- `WorkbenchCommandBar` receives concrete callbacks instead of owning API state.
- `WorkbenchStatusBar` receives `BeadProject | null`, `Cell | null`, and simple counts from `WorkbenchPage`.
