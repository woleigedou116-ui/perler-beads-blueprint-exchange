# Stage Wrap-Up Audit - 2026-06-22

This note records the project state before the next handoff. It is meant to help
another agent or developer continue without reading the whole chat history.

## Repository State

- Worktree:
  `D:\vibecoding_project\perlerbeads_blueprint_exchange\.worktrees\feature-mard-coco-mvp`
- Branch: `feature/mard-coco-mvp`
- Tracked files at audit time: 146
- Tracked files under `docs/`: 26
- Local status before this documentation update:
  `feature/mard-coco-mvp...origin/feature/mard-coco-mvp [ahead 1]`
- Known unpushed commit at audit time:
  `056323c fix: render target focus as separate frame`

Run this before continuing:

```powershell
git status --short --branch
```

## What Is Current

- MVP browser-based local app is usable for the main MARD-to-COCO workflow.
- The UI direction is now a desktop-style workbench, even though it still opens
  in a browser.
- Preview performance work has moved the heavy grid preview toward virtualization
  plus interaction-time DOM transforms.
- Recent COCO focus-frame work made the selected target cell outline independent
  from the cell fill/text, so the selected cell remains square.
- Backend hardening and import/storage safety work has been done and should be
  treated as part of the current baseline.
- Release packaging existed for `v0.1.1-mvp-test`; the next maintenance release
  should use `v0.1.2-mvp-test` so the latest frontend fixes and handoff docs are
  tied to a fresh tag instead of moving the old tag.

## Documentation Map

Primary entry points:

- `README.md` - user-facing overview, usage, packaging, development commands.
- `docs/agent-workflow/current-context.md` - current agent handoff context.
- `docs/frontend/frontend-architecture-source-of-truth.md` - frontend design,
  tokens, theme, i18n, and desktop-workbench direction.
- `docs/frontend/frontend-skeleton-acceptance.md` - acceptance notes for the
  frontend skeleton.

Release and acceptance:

- `docs/agent-workflow/release-packager-task.md` - packaging task card.
- `docs/releases/` - release notes and release README text.
- `docs/acceptance/mvp-sample-checklist.md` - sample-based MVP acceptance.

Historical task cards:

- `docs/agent-workflow/backend-hardening-tasks.md`
- `docs/agent-workflow/preview-zoom-sharpness-task.md`

These two are useful as implementation history and review context. They are not
active task lists unless a future request explicitly reopens them.

Older implementation planning:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `docs/implementation-progress.md`

Keep these as design/planning history. The latest operational handoff should be
`current-context.md`, not the older progress file.

## Multi-Agent Documents

The project contains a local multi-agent workflow:

- `docs/agent-workflow/local-agent-orchestrator-design.md`
- `docs/agent-workflow/main-agent-design.md`
- `docs/agent-workflow/sub-agents-design.md`
- `docs/agent-workflow/claude-code-deepseek.md`
- `.claude/agents/`

These documents have not been needed for most day-to-day work. They should stay
in the repository because:

- `AGENTS.md` explicitly references them.
- Claude Code / DeepSeek packaging or isolated executor work may use them.
- The main project has one recorded runtime workflow under
  `D:\vibecoding_project\perlerbeads_blueprint_exchange\.agent-work`.

Observed `.agent-work` runtime records:

- Requirement: `REQ-001-exclude-watermark-regions.md`
- Tasks: `TASK-001` through `TASK-005`
- Dev/test handoffs for each task
- One repair lesson: `TASK-005-fix-lesson.md`

Recommendation: do not delete the multi-agent docs now. Treat them as optional
process tooling. For normal small fixes, read only `current-context.md` and the
relevant code.

## Local Artifact Audit

Ignored local artifacts found during this audit:

| Path | Files | Approx. size | Notes |
| --- | ---: | ---: | --- |
| `.data/` | 495 | 408.15 MB | Local runtime projects and OCR benchmark outputs. Safe to delete only if local project history is not needed. |
| `.pytest_cache/` | 5 | 0.01 MB | Safe to delete. |
| `.venv/` | 8034 | 316.79 MB | Safe to delete if dependencies can be reinstalled. |
| `apps/web/node_modules/` | 9365 | 120.21 MB | Safe to delete if `npm install` can be run again. |
| `apps/web/dist/` | 3 | 0.26 MB | Build output; safe to delete. |
| `release/` | 187 | 602.95 MB | Local packages, smoke-test output, and release artifacts. Safe to delete after confirming no local package copy is needed. |
| `scripts/__pycache__/` | 2 | 0.01 MB | Safe to delete. |

These paths are already ignored by `.gitignore`, so they do not pollute the
repository. The largest cleanup candidates are `release/`, `.data/`, `.venv/`,
and `apps/web/node_modules/`.

## Redundancy Assessment

No tracked source file was identified as safe to delete during this pass.

Likely-safe local cleanup, after user confirmation:

- `.pytest_cache/`
- `scripts/__pycache__/`
- `apps/web/dist/`

Safe but more disruptive cleanup:

- `.venv/` - requires reinstalling Python dependencies.
- `apps/web/node_modules/` - requires reinstalling frontend dependencies.
- `release/` - removes local package copies and smoke-test artifacts.
- `.data/` - removes local runtime projects/benchmarks; confirm first.

Tracked docs to keep:

- Multi-agent docs and `.claude/agents/`, because they are referenced and may be
  useful for packaging/delegated work.
- Historical task cards, because they explain why recent hardening/performance
  changes exist.
- Release docs, because GitHub release notes and local packaging history may
  need them.

## Recommended Next Steps

1. Verify the latest UI in the browser after this documentation-only wrap-up.
2. Push the local branch if the latest focus-frame commit and this wrap-up should
   be shared.
3. If a new MVP package is needed, rebuild with
   `docs/agent-workflow/release-packager-task.md`.
4. If disk cleanup is desired, delete the ignored local artifacts listed above,
   starting with `.pytest_cache/`, `scripts/__pycache__/`, and `apps/web/dist/`.
