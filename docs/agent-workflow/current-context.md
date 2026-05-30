# Current Context

This project is currently small enough to continue mostly in one coding conversation.
Use this file as the first stop for future agents before reading the full local
multi-agent workflow.

## Project

- Main project: `D:\vibecoding_project\perlerbeads_blueprint_exchange`
- Active worktree: `D:\vibecoding_project\perlerbeads_blueprint_exchange\.worktrees\feature-mard-coco-mvp`
- Runtime multi-agent records: `D:\vibecoding_project\perlerbeads_blueprint_exchange\.agent-work`

## Current Product Direction

The watermark/unwanted-area correction flow is result-first:

- Users upload and recognize an image first.
- After the result appears, users can mark a single grid cell as not a bead.
- Users can select a rectangular grid range and remove it as non-bead content.
- Pre-recognition crop, multiple boxes, polygon selection, and explicit watermark
  exclusion are future extensions, not the primary current flow.

## Implemented Surface

- Backend: `PATCH /api/projects/{project_id}/cells/unwanted`
- Single-cell payload: `{"row": 0, "column": 0}`
- Rectangular range payload:
  `{"start_row": 0, "start_column": 0, "end_row": 1, "end_column": 1}`
- Marked cells become `empty`, source/target/OCR fields are cleared, and
  `user-marked-unwanted` is recorded.
- Frontend actions include `标记为非拼豆`, `框选非拼豆区域`, `应用框选区域`, and
  `取消框选`.

## Verification Commands

Backend targeted tests:

```powershell
.\.venv\Scripts\python -m pytest apps/api/tests/test_project_store.py apps/api/tests/test_exports.py apps/api/tests/test_projects_api.py -q
```

Frontend tests and build:

```powershell
cd apps\web
npm test -- --run
npm run build
```

## Agent Notes

- For ordinary single-conversation development, prefer this file plus the local
  code/tests over the full orchestration documents.
- For coordinated multi-agent work, read:
  - `docs/agent-workflow/local-agent-orchestrator-design.md`
  - `docs/agent-workflow/main-agent-design.md`
  - `docs/agent-workflow/sub-agents-design.md`
  - `docs/agent-workflow/claude-code-deepseek.md`
- Claude Code subagent prompts live in `.claude/agents/`.
- If using Claude Code through DeepSeek, credentials and routing should remain in
  local environment/config files, not this repository.

## Lessons To Preserve

When adding a persisted cell state, test downstream consumers too: export,
statistics, archives, warnings, frontend display, and frontend API typing.
