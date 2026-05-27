# Preview Zoom And Review Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add readable synchronized zoom/pan controls and an application-level full-screen review layout for the two blueprint previews.

**Architecture:** A new `ComparisonPreview` component owns a single viewport state (`zoom` and `pan`) and renders both existing `GridPreview` instances with the same transform. `WorkbenchPage` continues to own project actions while holding only review-mode layout state, so recognition/export code and persisted project data do not change.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, Vite

---

## File Structure

- Create `apps/web/src/features/workbench/ComparisonPreview.tsx`: paired-preview toolbar and shared viewport interactions.
- Create `apps/web/src/features/workbench/ComparisonPreview.test.tsx`: component-level tests for synchronized zoom, pan reset, and full-screen toggle callbacks.
- Modify `apps/web/src/features/workbench/GridPreview.tsx`: accept shared transform and viewport pointer/wheel hooks without owning coordination state.
- Modify `apps/web/src/features/workbench/GridPreview.test.tsx`: preserve source-overlay behavior while asserting external transform rendering.
- Modify `apps/web/src/features/workbench/WorkbenchPage.tsx`: replace direct paired previews with `ComparisonPreview`, hold application review-mode state and `Escape` exit.
- Modify `apps/web/src/features/workbench/WorkbenchPage.test.tsx`: verify application review-mode layout and keyboard exit.
- Modify `apps/web/src/styles/app.css`: viewport clipping, toolbars, pan cursor, and expanded review-mode layout.
- Modify `docs/implementation-progress.md` and `docs/acceptance/mvp-sample-checklist.md`: record the verified preview usability enhancement.

### Task 1: Shared Zoom Controls And Transformed Previews

**Files:**
- Create: `apps/web/src/features/workbench/ComparisonPreview.tsx`
- Create: `apps/web/src/features/workbench/ComparisonPreview.test.tsx`
- Modify: `apps/web/src/features/workbench/GridPreview.tsx`
- Modify: `apps/web/src/features/workbench/GridPreview.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] **Step 1: Write failing shared-zoom tests**

Create `ComparisonPreview.test.tsx` with a test that renders the paired component,
clicks `放大`, checks the displayed percentage changes from `100%` to `125%`,
and asserts that both `.preview-transform` elements have
`transform: translate(0px, 0px) scale(1.25)`. Extend
`GridPreview.test.tsx` to pass `transform={{ zoom: 1.25, panX: 8, panY: -4 }}`
and require a `.preview-transform` wrapper with the corresponding CSS transform.
Add a second assertion path that fires a wheel-up event over either viewport
and confirms the same shared `125%` scale is applied to both views.

- [ ] **Step 2: Verify tests fail for missing component and transform contract**

Run:

```powershell
cd apps\web
npm test -- --run src/features/workbench/ComparisonPreview.test.tsx src/features/workbench/GridPreview.test.tsx
```

Expected: FAIL because `ComparisonPreview` does not exist and `GridPreview`
does not expose the transformed viewport wrapper.

- [ ] **Step 3: Implement minimal shared zoom rendering**

Add these public contracts:

```tsx
export interface PreviewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

interface ComparisonPreviewProps {
  project: BeadProject;
  sourceImageUrl: string | null;
  fullscreen: boolean;
  onFullscreenChange: (next: boolean) => void;
  onSelectCell: (cell: Cell) => void;
}
```

`ComparisonPreview` initializes `{ zoom: 1, panX: 0, panY: 0 }`, provides
`放大`, `缩小`, and `适应窗口` buttons, clamps zoom to `1` through `4` in
`0.25` increments, handles viewport wheel events using the same increment,
resets pan when fitting, and sends the same transform prop to both
`GridPreview` children. `GridPreview` wraps its rendered image/SVG in:

```tsx
<div className="preview-viewport">
  <div
    className="preview-transform"
    style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
  >
    {content}
  </div>
</div>
```

Keep the existing original-image overlay and COCO SVG contents inside
`preview-transform`.

- [ ] **Step 4: Add viewport styling**

Add CSS for a compact `.comparison-toolbar`, `.preview-viewport` with clipped
overflow and an increased minimum viewing height, and `.preview-transform`
using centered transform origin. At `100%`, both views show the complete
pattern; at higher zoom values, the clipped viewport displays details.

- [ ] **Step 5: Verify shared-zoom tests pass**

Run:

```powershell
cd apps\web
npm test -- --run src/features/workbench/ComparisonPreview.test.tsx src/features/workbench/GridPreview.test.tsx
```

Expected: PASS for shared transform and source-image overlay tests.

### Task 2: Synchronized Drag And Fit Reset

**Files:**
- Modify: `apps/web/src/features/workbench/ComparisonPreview.tsx`
- Modify: `apps/web/src/features/workbench/ComparisonPreview.test.tsx`
- Modify: `apps/web/src/features/workbench/GridPreview.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] **Step 1: Write failing synchronized-pan test**

Add a test that zooms to `125%`, fires pointer down/move/up on the first
`.preview-viewport`, and asserts that both transforms become
`translate(24px, 16px) scale(1.25)`. Then click `适应窗口` and assert both
return to `translate(0px, 0px) scale(1)`.

- [ ] **Step 2: Verify the pan test fails before implementation**

Run:

```powershell
cd apps\web
npm test -- --run src/features/workbench/ComparisonPreview.test.tsx
```

Expected: FAIL because dragging does not yet update shared pan state.

- [ ] **Step 3: Implement shared pointer dragging**

`ComparisonPreview` tracks pointer-start coordinates and initial pan only while
`zoom > 1`, updates the single `pan` state during movement, and stops dragging
on pointer up/cancel. Pass pointer handlers and a `pannable` flag to each
`GridPreview` viewport; set and release pointer capture when those browser
methods are available. Attach the same handlers to both previews so dragging
either side moves both views.

- [ ] **Step 4: Style panning cues**

Set `.preview-viewport.is-pannable` to a grab cursor and
`.preview-viewport.is-dragging` to a grabbing cursor. Prevent selection during
dragging while retaining clickable review rectangles when no drag occurs.

- [ ] **Step 5: Verify synchronized dragging and reset**

Run:

```powershell
cd apps\web
npm test -- --run src/features/workbench/ComparisonPreview.test.tsx src/features/workbench/GridPreview.test.tsx
```

Expected: PASS.

### Task 3: Application Full-Screen Review Layout

**Files:**
- Modify: `apps/web/src/features/workbench/ComparisonPreview.tsx`
- Modify: `apps/web/src/features/workbench/ComparisonPreview.test.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] **Step 1: Write failing review-mode tests**

Add a component test that clicks `全屏查看` and expects
`onFullscreenChange(true)`. Add workbench tests that import a pattern, click
`全屏查看`, require the `.workbench.review-fullscreen` layout and an
`退出全屏` control, then fire `Escape` and require normal layout again.

- [ ] **Step 2: Verify review-mode tests fail**

Run:

```powershell
cd apps\web
npm test -- --run src/features/workbench/ComparisonPreview.test.tsx src/features/workbench/WorkbenchPage.test.tsx
```

Expected: FAIL because no review-mode toggle or keyboard exit exists.

- [ ] **Step 3: Implement layout mode and keyboard exit**

`ComparisonPreview` displays `全屏查看` when `fullscreen` is false and
`退出全屏` when true; each button calls `onFullscreenChange`. Replace the
two direct `GridPreview` calls in `WorkbenchPage` with `ComparisonPreview`,
add `isReviewFullscreen` state, and install an effect that closes the mode on
`Escape`. Apply class `review-fullscreen` to the workbench container only when
active.

- [ ] **Step 4: Implement expanded layout CSS**

In review mode, hide `.upload-panel`, expand the center preview across the
freed column, keep `.review-panel` visible, increase viewport height, and keep
the toolbar accessible. The layout remains within the browser page rather than
requesting native browser full-screen permission.

- [ ] **Step 5: Verify review-mode tests pass**

Run:

```powershell
cd apps\web
npm test -- --run src/features/workbench/ComparisonPreview.test.tsx src/features/workbench/WorkbenchPage.test.tsx
```

Expected: PASS.

### Task 4: Quality Gate And Acceptance Record

**Files:**
- Modify: `docs/implementation-progress.md`
- Modify: `docs/acceptance/mvp-sample-checklist.md`

- [ ] **Step 1: Run full frontend verification**

Run:

```powershell
cd apps\web
npm test -- --run
npm run build
```

Expected: all Vitest tests PASS; TypeScript and Vite production build succeed.

- [ ] **Step 2: Run backend regression verification**

Run:

```powershell
.\.venv\Scripts\python -m pytest -q
```

Expected: all existing API, recognition, and export tests PASS because this
change does not modify backend behavior.

- [ ] **Step 3: Inspect the built UI with a real pattern**

Open `http://127.0.0.1:8765`, upload one clear `40 x 63` sample and one
watermarked sample, and check that zoom, dragging, full-screen entry/exit, and
review-marker alignment remain usable.

- [ ] **Step 4: Update progress and acceptance notes**

Record the new frontend test count, production build result, backend test
result, and manual zoom/review checks in the existing documentation files.

- [ ] **Step 5: Commit verified implementation**

```powershell
git add apps/web/src docs/implementation-progress.md docs/acceptance/mvp-sample-checklist.md
git commit -m "feat: add synchronized blueprint zoom review"
```
