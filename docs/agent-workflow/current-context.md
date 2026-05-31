# Current Context

Last updated: 2026-06-01.

This project is currently small enough to continue mostly in one coding
conversation. Use this file as the first stop for future agents before reading
the full local multi-agent workflow.

## Project

- Main project: `D:\vibecoding_project\perlerbeads_blueprint_exchange`
- Active worktree: `D:\vibecoding_project\perlerbeads_blueprint_exchange\.worktrees\feature-mard-coco-mvp`
- Branch: `feature/mard-coco-mvp`
- Runtime multi-agent records: `D:\vibecoding_project\perlerbeads_blueprint_exchange\.agent-work`
- Current local app URL when service is running: `http://127.0.0.1:8787/`

The sample image names were recently changed. Current files in
`D:\vibecoding_project\perlerbeads_blueprint_exchange\拼豆样例图` include:

- `初音未来.jpg`
- `大耳帽兜.jpg` - formerly the 40 x 63 Cinnamoroll sample.
- `恶魔狼.jpg`
- `高级咕噜球.jpg`
- `棱镜球.jpg`
- `小夜_有水印版.jpg` - watermark sample.

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
- Export supports clean image, overlay image, mapping CSV, and `.beadproject`.
- `.beadproject` archives now preserve the original source image, so reopening a
  saved project can reload the uploaded image.
- Frontend has zoom/pan controls, source overlay toggle, target overlay toggle,
  color statistics toggle, palette reference, review panel, and selectable
  non-bead regions.

## Recent OCR Performance Work

The random recognition slowdown was traced to RapidOCR / ONNX Runtime CPU
threading, not to color clustering, OCR representative count, or the frontend.

Important conclusions:

- OCR result cache was deliberately disabled by default because it can mask
  validation results during manual acceptance testing.
- Timing diagnostics were added to upload responses and the upload panel:
  `本次识别用时`, `服务端总耗时`, `OCR识别`, `OCR代表格`, `OCR调用耗时`,
  `OCR最慢单次`, and `等待/渲染差值`.
- Direct service tests showed `大耳帽兜.jpg` should normally use 9 OCR
  representative cells.
- The major fix was to set ONNX Runtime thread counts explicitly in
  `apps/api/src/bead_converter/vision/ocr.py`.
- The current default is the gentler setting:
  `intra_op_num_threads = 2`, `inter_op_num_threads = 1`.
- Earlier `4` threads were faster but caused noticeably higher CPU spikes. The
  current `2` thread setting is intentionally more comfortable for desktop use.

Recent commits to know:

- `6a62df9 perf: use gentler OCR thread count`
- `60c56c8 chore: add OCR engine call diagnostics`
- `c41fa09 perf: limit RapidOCR CPU threads`
- `726ad16 chore: expose OCR timing diagnostics`
- `f338562 feat: show recognition timing diagnostics`
- `5fb27c8 fix: prevent duplicate image imports`
- `a32c74b chore: disable OCR result cache by default`
- `36483a6 fix: isolate recognition timing updates`

Current rough performance with the gentler default:

- `大耳帽兜.jpg`: about 2.0 seconds after OCR initialization.
- `高级咕噜球.jpg`: about 2.6 seconds.
- `小夜_有水印版.jpg`: about 8.6 seconds.

If the user reports another slow recognition, inspect the timing card:

- Large `等待/渲染差值`: likely browser/request queue/rendering.
- Large `OCR调用耗时` and large `OCR最慢单次`: one underlying OCR engine call
  stalled.
- Large `OCR调用耗时` but small `OCR最慢单次`: OCR calls are collectively slower,
  likely scheduling/resource contention.
- `OCR代表格` unexpectedly high: representative-cell selection changed and
  should be investigated in `apps/api/src/bead_converter/vision/recognizer.py`.

## Local Service

Start or restart the local service from the active worktree:

```powershell
$owner=(Get-NetTCPConnection -LocalPort 8787 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)
if ($owner) { Stop-Process -Id $owner -Force; Start-Sleep -Seconds 1 }
$env:PYTHONPATH='apps/api/src'
Start-Process -FilePath '.\.venv\Scripts\python.exe' -ArgumentList @('-m','uvicorn','bead_converter.main:app','--host','127.0.0.1','--port','8787') -WorkingDirectory (Get-Location) -WindowStyle Hidden
Start-Sleep -Seconds 3
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/health'
```

Open the app at:

```text
http://127.0.0.1:8787/
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

Recent verification after the OCR thread-count change:

- Backend full tests: 79 passed.
- Frontend full tests: 74 passed.
- Frontend build: passed.
- Direct API recognition test on `大耳帽兜.jpg`: stable around 2 seconds after
  OCR initialization.

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
- For packaging/release builds, delegate the noisy build and zip verification to
  a release packager agent using `docs/agent-workflow/release-packager-task.md`.
- The user prefers ordinary single-window development for product work. Do not
  launch complex multi-agent workflow unless explicitly asked.
- The user generally wants bug fixes committed after verification.
- Do not revert or delete unrelated changes from other agents or the user.
- If continuing performance work, avoid re-enabling OCR cache as a "fix"; it was
  disabled by default to keep acceptance testing honest.

## Lessons To Preserve

When adding a persisted cell state, test downstream consumers too: export,
statistics, archives, warnings, frontend display, and frontend API typing.

For OCR performance, check CPU thread settings and backend timing diagnostics
before changing recognition heuristics. A faster-looking cache can hide real OCR
behavior during acceptance testing.
