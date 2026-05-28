# Review Workbench Controls Design

Date: 2026-05-28

## Goal

Improve the image review workspace so large pattern images can be inspected
comfortably while keeping correction actions and color references close at hand.

## Preview Controls

- The recognition preview and COCO redraw preview have independent zoom and pan
  state. Each card owns its own zoom controls, wheel zoom, drag pan, and fit
  reset.
- The recognition preview keeps showing the uploaded source image. A visible
  toggle controls whether review-required marker rectangles are overlaid on top.
- A locate action from the review list selects the cell, highlights it in both
  previews, and moves both previews toward that cell using an inspection zoom.

## Review Panel

- The right review panel keeps a fixed usable height. The pending-review list
  scrolls internally so it cannot stretch the entire page.
- Each pending item exposes three primary actions:
  - Locate: select and focus the cell in the previews.
  - Confirm: accept the current suggested MARD-to-COCO mapping.
  - Modify: open inline correction options.
- Modify mode shows nearby COCO color candidates calculated from the sampled
  cell color and palette RGB values. Candidate buttons update the selected cell
  by calling the existing cell correction API. The manual correction form stays
  as a fallback.

## Palette Reference

- A floating color reference button sits over the workspace without consuming
  the right review column.
- The floating panel has two modes:
  - Used colors: colors present in the current project with counts.
  - All colors: every loaded MARD-to-COCO palette mapping.
- Each row shows a source color swatch/code, target color swatch/code, and count
  when available.

## Recognition Progress

- While image import is in progress, the upload panel shows a determinate
  staged progress bar. The backend import endpoint is still a single request,
  so this is a front-end progress guide rather than server-streamed telemetry.
- The stages are upload, grid detection, OCR/color matching, and project
  generation. The bar disappears after success or failure.

## Testing

- Component tests cover independent preview transforms, overlay toggle behavior,
  locate focus, review-card actions, approximate color candidate sorting,
  floating palette modes, and import progress visibility.
- Existing end-to-end component tests continue to cover upload, review, export
  confirmation, project reopen, and source-image overlay behavior.
