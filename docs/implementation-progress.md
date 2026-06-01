# MVP Implementation Progress

Last updated: 2026-05-29

## Resume Location

- Worktree: `.worktrees/feature-mard-coco-mvp`
- Branch: `feature/mard-coco-mvp`
- Plan: `docs/superpowers/plans/2026-05-26-perler-bead-standard-converter-mvp.md`
- Design: `docs/superpowers/specs/2026-05-26-perler-bead-standard-converter-design.md`

## Completed Checkpoints

| Plan task | Commit | Result |
| --- | --- | --- |
| Task 1 | `515122e` | Local FastAPI/React scaffold |
| Task 2 | `4c3b66e` | Editable project model and store |
| Task 3 | `56822fc` | Initial verified MARD to COCO palette data |
| Task 4 | `97573ce` | Regular grid detection |
| Task 5 | `90ba90a` | Cell color sampling evidence |
| Task 6 | `1fd6330` | OCR adapter and probe |
| Task 7 | `214877a` | Combined recognition pipeline |
| Task 8 | `b4e53e0` | Local project conversion API |
| Task 9 | `8080ddc` | CSV, image and project archive exports |
| Task 10 | `8d14629` | Upload, review, correction and export UI |
| Task 11 | `feat: deliver local mard to coco conversion mvp` | Hosting and real-sample acceptance |
| Task 12 | `feat: overlay review cells on source image` | Source-image overlay correction and final quality gate |
| Preview review | `feat: add synchronized blueprint zoom review` | Synchronized zoom, panning, and full-screen review layout |
| Review controls | `feat: add review workbench controls` | Independent preview controls, focused review actions, progress, and palette reference |

## Active Checkpoint

- Review workbench controls have been implemented and verified on 2026-05-28.
- The recognition preview and COCO redraw now have independent zoom and drag
  controls, reset separately, and keep the full-screen review layout available.
- The recognition preview can hide or show review markers over the uploaded
  source image without losing the source-image context.
- Review cards now provide locate, confirm, and modify actions; modify offers
  nearest target-color candidates from the palette data.
- The import flow shows a staged recognition progress bar, and the workbench
  exposes a floating palette reference that switches between colors used in the
  current pattern and all MARD-to-COCO mappings.
- Backend tests pass with 38 tests; frontend tests pass with 26 tests;
  TypeScript/Vite production build passes; the hosted UI opens locally.
- Preview follow-up fixes raise the zoom ceiling to 800%, rename the per-card
  reset action, center located cells using measured preview dimensions, and
  wait for uploaded image dimensions before drawing source-image review markers.
- The source image no longer starts native browser dragging when overlays are
  hidden; locate centers both previews while preserving each side's current
  zoom; preview and clean-export labels use automatic contrast with a light/dark
  stroke.
- The COCO redraw now uses larger on-screen bead labels and can show or hide a
  target-color statistics strip. Clean and overlay PNG exports can include or
  omit the same color-count statistics.
- Color statistics now normalize API palette RGB arrays before display, so
  target swatches and the COCO redraw use the real target-standard colors.
  Clean PNG exports use the same 52 px cell size and centered 16 px labels as
  the on-screen redraw preview.
- The palette reference now loads the full local MARD-to-COCO table: 287
  mappings are available. User review on 2026-05-29 corrected `M9 -> Y09`
  and `M10 -> Y10`, and the current table is fully marked as manually
  verified. Image and project exports now use the browser save dialog when
  available, with the old download behavior as a fallback.
- The review queue now groups repeated pending cells by suggested source-target
  mapping, so confirming a repeated mapping can clear an entire color group
  instead of requiring one card per bead. The floating palette reference also
  distinguishes very light or missing swatches and reserves a fixed count column
  so used-count numbers stay aligned.
- Six local sample images were rechecked for review volume. The new grouping
  reduces the visible correction queue from cells to mapping groups, for example
  `806` pending cells to `11` groups on the Hatsune sample and `2181` pending
  cells to `37` groups on the watermarked sample.
- Preview sizing follow-up fixes make the source-image overlay share the
  uploaded image's intrinsic size, give regenerated SVG previews explicit
  dimensions, and center located cells against the same visually constrained
  preview bounds the browser renders.
- The original four image acceptance results remain recorded, and the two
  additional user-provided images now also complete import, all exports, and
  `.beadproject` reopen checks. Details are recorded in
  `docs/acceptance/mvp-sample-checklist.md`.
- Latest full verification on 2026-05-29: backend tests pass with 44 tests;
  frontend tests pass with 36 tests; TypeScript/Vite production build passes.
- Watermarked-image recognition was profiled on 2026-05-30. Tesseract and
  full-image contrast preprocessing were not adopted: Tesseract produced more
  reviews than RapidOCR, and full-image preprocessing reduced review counts
  mainly by turning pale cells into false empty cells. The useful fix was
  refining empty-cell detection so faint watermark/background patches are not
  treated as beads.
- `scripts/ocr_benchmark.py` now supports filename filtering, OCR-only/full
  preprocessing experiments, and an optional slower watermark OCR profile for
  future comparison work.
- The palette RGB display data was refreshed from the local
  `拼豆色卡对照_1` image after the floating reference exposed several red and
  brown mappings that had been sampled as near-white. The source/target code
  mappings were not changed.
- Current six-sample benchmark after the RGB refresh and OCR conflict threshold
  adjustment: the four non-watermarked samples remain at `0` pending reviews;
  `有水印版.jpg` is at `576`, and
  `洛克王国｜恶魔狼_2_玉米大盗_来自小红书网页版_有水印.jpg` is at `770`. The second watermarked
  sample now keeps more white/light beads as reviewable suggestions instead of
  silently treating them as empty.
- Latest backend verification on 2026-05-30: backend tests pass with 56 tests.
- Desktop-style UI redesign plan and implementation split were added on
  2026-06-01. The current implementation keeps the browser architecture but
  reshapes the frontend toward a reusable desktop workbench shell.

## Remaining Checkpoints

- User operation acceptance: try the local workbench with familiar patterns
  and report any corrections that feel repetitive or unclear.

## Recovery Procedure

1. Open this worktree and run `git status --short --branch --untracked-files=all`.
2. Read this file and inspect the most recent branch commits.
3. Preserve any uncommitted files and continue the active checkpoint.
4. After each verified task, update this file in the same task commit.
