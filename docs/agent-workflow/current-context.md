# Current Context

Last updated: 2026-06-22.

Use this file as the first stop for future agents. It is the short handoff for
the current worktree; read the more specific documents only when the task needs
them.

## Project

- Main project: `D:\vibecoding_project\perlerbeads_blueprint_exchange`
- Active worktree:
  `D:\vibecoding_project\perlerbeads_blueprint_exchange\.worktrees\feature-mard-coco-mvp`
- Branch: `feature/mard-coco-mvp`
- Runtime multi-agent records:
  `D:\vibecoding_project\perlerbeads_blueprint_exchange\.agent-work`
- Main local app URL when the packaged/dev desktop service is running:
  `http://127.0.0.1:8765/`
- Frontend Vite dev URL, when running frontend separately:
  `http://127.0.0.1:5173/`

As of the stage wrap-up audit on 2026-06-22, the branch was ahead of
`origin/feature/mard-coco-mvp` by at least one local commit:

- `056323c fix: render target focus as separate frame`

Check `git status --short --branch` before continuing. Do not assume this
handoff reflects later pushes or local commits.

## Current Product State

The project is an MVP local tool for converting regular MARD perler-bead
blueprints into reviewable/exportable COCO projects.

- Users upload a local blueprint image.
- The backend detects the grid, samples colors, runs OCR, and maps MARD to COCO.
- The frontend shows a source overlay and COCO redraw preview.
- Users review uncertain cells by group, confirm groups, modify groups, or fix a
  single cell.
- Users can mark a single cell or rectangular region as non-bead content.
- Users can hide overlays, hide COCO labels, hide color statistics, save
  `.beadproject`, reopen projects, and export CSV/image/project outputs.
- The current UI still runs in a browser, but the visual direction is a
  desktop-software style workbench.

## Current Frontend Direction

The frontend rewrite is guided by:

- `docs/frontend/frontend-architecture-source-of-truth.md`
- `docs/frontend/frontend-skeleton-acceptance.md`

Important recent frontend work:

- A desktop-workbench visual skeleton was introduced.
- `GridPreview` now virtualizes visible cells so large projects do not render
  every grid cell at once.
- Preview pan/zoom uses direct DOM transform updates during interaction and
  commits React state after the gesture.
- Wheel zoom commits immediately enough to keep the two preview panels aligned
  and avoid stale zoom/blur behavior after interaction.
- The selected target cell frame is rendered as a separate outline instead of
  filling or distorting the COCO cell.
- Source/target preview reset and image-change behavior were tightened so the
  panels recenter correctly between projects.

If changing preview behavior, inspect these files first:

- `apps/web/src/features/workbench/ComparisonPreview.tsx`
- `apps/web/src/features/workbench/GridPreview.tsx`
- `apps/web/src/features/workbench/previewVirtualization.ts`
- `apps/web/src/styles/app.css`

## Current Backend And Packaging Direction

Backend and packaging are stable enough for MVP testing.

- Backend API lives under `apps/api/src/bead_converter/`.
- Static frontend output is served by the FastAPI desktop service after build.
- Runtime project data belongs in `.data/`, which is ignored.
- Windows portable packaging is documented in
  `docs/agent-workflow/release-packager-task.md`.
- Build artifacts belong in `release/`, `dist/`, or `build/`, all ignored.

Packaging/release builds have been delegated to Claude Code / DeepSeek-style
executor runs before, mainly to keep noisy build output out of the main coding
conversation. That is optional; ordinary code changes do not need the full
multi-agent workflow.

## Local Service

Integrated app service:

```powershell
.\.venv\Scripts\python scripts\dev.py
```

Open:

```text
http://127.0.0.1:8765/
```

Separate frontend development:

```powershell
cd apps\web
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Verification Commands

Backend full tests:

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Backend targeted tests for common project/export/API changes:

```powershell
.\.venv\Scripts\python -m pytest apps/api/tests/test_project_store.py apps/api/tests/test_exports.py apps/api/tests/test_projects_api.py -q
```

Frontend tests and build:

```powershell
cd apps\web
npm test -- --run
npm run build
```

For frontend visual or interaction changes, also verify in a real browser on
`127.0.0.1`; jsdom tests cannot prove canvas/SVG sharpness or GPU compositing
behavior.

## Handoff Reading Order

For ordinary continuation:

1. `docs/agent-workflow/current-context.md`
2. `README.md`
3. `docs/frontend/frontend-architecture-source-of-truth.md` for frontend work
4. Relevant code/tests for the exact area being changed

For release packaging:

1. `docs/agent-workflow/release-packager-task.md`
2. `docs/releases/`
3. `README.md`

For coordinated multi-agent or Claude Code / DeepSeek work:

1. `docs/agent-workflow/local-agent-orchestrator-design.md`
2. `docs/agent-workflow/main-agent-design.md`
3. `docs/agent-workflow/sub-agents-design.md`
4. `docs/agent-workflow/claude-code-deepseek.md`
5. `.claude/agents/`

The multi-agent documents are retained because `AGENTS.md` references them and
the project has one recorded runtime workflow under `.agent-work/`. They are not
needed for normal single-agent bug fixes.

Completed task cards kept for traceability:

- `docs/agent-workflow/backend-hardening-tasks.md`
- `docs/agent-workflow/preview-zoom-sharpness-task.md`

Treat these as historical review/task records unless a new request explicitly
reopens them.

## Local Artifacts And Cleanup

The following directories are intentionally ignored and should not be committed:

- `.data/` - local runtime projects and OCR benchmark outputs
- `.venv/` - local Python environment
- `.pytest_cache/` - local test cache
- `apps/web/node_modules/` - local Node dependencies
- `apps/web/dist/` - frontend build output
- `release/`, `dist/`, `build/` - local packaging output
- `scripts/__pycache__/` and other `__pycache__/` folders

These are safe to delete when you do not need local runtime projects, build
outputs, or installed dependencies. Deleting `.venv` or `node_modules` only means
the dependencies must be installed again.

## Agent Notes

- The user prefers direct, scoped implementation and verification over broad
  process ceremony.
- Do not launch the full multi-agent workflow unless explicitly asked.
- The user generally wants bug fixes committed after verification.
- Do not revert or delete unrelated changes from other agents or the user.
- If continuing performance work, avoid re-enabling OCR cache as a quick fix; it
  can mask real recognition behavior during acceptance testing.
- If updating handoff docs, keep them current and short enough for the next
  agent to actually read.

## Lessons To Preserve

When adding a persisted cell state, test downstream consumers too: export,
statistics, archives, warnings, frontend display, and frontend API typing.

For OCR performance, check CPU thread settings and backend timing diagnostics
before changing recognition heuristics. A faster-looking cache can hide real OCR
behavior during acceptance testing.

For preview performance, remember that avoiding React commits during drag is not
enough by itself. Large grids need virtualization, wheel/pinch behavior must not
fight the pan/zoom state, and visual sharpness has to be checked in a real
browser.
