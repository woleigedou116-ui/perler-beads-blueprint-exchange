# Review Workbench Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent preview navigation, overlay toggling, scroll-bounded review actions, staged import progress, and a floating palette reference to the local workbench.

**Architecture:** Keep the feature in the existing React workbench. `ComparisonPreview` manages preview transforms and focus requests, `ReviewPanel` manages review-card actions and candidate display, and a new `PaletteReference` component owns the floating color table.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, existing FastAPI palette endpoint.

---

### Task 1: Independent Preview Controls

**Files:**
- Modify: `apps/web/src/features/workbench/ComparisonPreview.tsx`
- Modify: `apps/web/src/features/workbench/GridPreview.tsx`
- Modify: `apps/web/src/features/workbench/ComparisonPreview.test.tsx`
- Modify: `apps/web/src/features/workbench/GridPreview.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] Write failing tests that prove left and right previews zoom/pan independently.
- [ ] Add per-preview transform state and per-preview viewport handlers.
- [ ] Add recognition overlay toggle that hides marker rectangles while keeping the uploaded image visible.
- [ ] Add focused-cell highlighting and focus-request transform reset.
- [ ] Run focused preview tests until they pass.

### Task 2: Review Panel Actions

**Files:**
- Modify: `apps/web/src/features/workbench/ReviewPanel.tsx`
- Create: `apps/web/src/features/workbench/ReviewPanel.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] Write failing tests for Locate, Confirm, Modify, and nearest-color candidate selection.
- [ ] Add review-card action buttons and inline modify panel.
- [ ] Sort candidate COCO colors by sampled RGB distance.
- [ ] Limit the review list height and make it scroll internally.
- [ ] Run review panel tests until they pass.

### Task 3: Palette Reference

**Files:**
- Create: `apps/web/src/features/workbench/PaletteReference.tsx`
- Create: `apps/web/src/features/workbench/PaletteReference.test.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/domain/types.ts`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] Write failing tests for opening the floating palette and switching Used/All.
- [ ] Add palette API client types and fetch call.
- [ ] Render the floating palette in the workbench when a project is loaded.
- [ ] Run palette and workbench tests until they pass.

### Task 4: Recognition Progress

**Files:**
- Modify: `apps/web/src/features/upload/UploadPanel.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.tsx`
- Modify: `apps/web/src/features/workbench/WorkbenchPage.test.tsx`
- Modify: `apps/web/src/styles/app.css`

- [ ] Write failing test that import displays a progressbar with staged text while pending.
- [ ] Add staged progress state driven by the existing processing flag.
- [ ] Hide progress after import success or failure.
- [ ] Run workbench tests until they pass.

### Task 5: Verification and Docs

**Files:**
- Modify: `docs/implementation-progress.md`
- Modify: `docs/acceptance/mvp-sample-checklist.md`

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Run `.venv/Scripts/python.exe -m pytest -q`.
- [ ] Open the local app in the browser and smoke-check the controls.
- [ ] Update progress and acceptance notes.
- [ ] Commit the verified implementation.
