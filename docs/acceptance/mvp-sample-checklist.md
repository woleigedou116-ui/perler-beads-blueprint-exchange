# MVP Sample Acceptance Checklist

Date: 2026-05-28

## Scope

The implementation plan identified four local reference images in `拼豆样例图/`.
Those four images were checked during Task 11. On 2026-05-27, the user supplied
two additional local images for validation; they have now been promoted from
probe-only inputs to additional acceptance cases. All sample images remain
ignored local materials and are not committed as application assets.

## Verification

- Backend: `.\.venv\Scripts\python -m pytest -q` passed with 37 tests.
- Frontend: Vitest passed with 20 tests; TypeScript checking and Vite build passed.
- Hosted UI: the built app was opened at `http://127.0.0.1:8765`; the upload,
  local-processing notice, review area, `.beadproject` open input, and preview
  zoom/full-screen controls are covered by smoke and component checks.
- OCR probe: `.\.venv\Scripts\python scripts\ocr_probe.py ..\..\拼豆样例图`
  runs safely with Windows console-compatible filenames.
- Source overlay regression: the uploaded source image is shown under
  review-required rectangles positioned from detected image coordinates.

## Sample Results

The "export and reopen" column records that exports remain available with risk
warnings and that the saved project can be reopened; fully resolving every
review cell was not necessary for this acceptance pass.

| 样例文件 | 网格检测结果 | OCR 自动确认格数 / 30 格抽样命中 | 待确认格数 | 可导出并重开 | 备注 |
| --- | --- | ---: | ---: | --- | --- |
| `Camera_1040g3k031uui79pdii005q1lk2cmr1strkjq910.jpg` | `40 x 63` | `1180 / 27` | `175` | 是，四类导出 `200`，项目重开 `201` | 修复前图例横线会被误识别为额外行 |
| `Camera_1040g3k831vntl89sig305p14d3fah7q4bm44fjg.jpg` | `37 x 37` | `212 / 29` | `785` | 是，四类导出 `200`，项目重开 `201` | 未确认格以风险响应头保留 |
| `Camera_1040g3k831vntl89sig3g5p14d3fah7q4g89tpvo.jpg` | `37 x 37` | `136 / 29` | `861` | 是，四类导出 `200`，项目重开 `201` | 未确认格以风险响应头保留 |
| `有水印版.jpg` | `50 x 50` | `293 / 14` | `2181` | 是，四类导出 `200`，项目重开 `201` | 水印图按设计进入大量人工校对 |
| `拼豆日记📖No.13_3_雪芙_来自小红书网页版.jpg` | `30 x 36` | `21 / 21` | `741` | 是，四类导出 `200`，项目重开 `201` | 文件名含符号且 OCR 覆盖较少，适合复核流程验收 |
| `洛克王国｜恶魔狼_2_玉米大盗_来自小红书网页版_有水印.jpg` | `48 x 48` | `267 / 13` | `1534` | 是，四类导出 `200`，项目重开 `201` | 水印素材，按设计保留大量人工复核 |

## Acceptance Fixes

- Grid recovery now tolerates a little over half of periodic lines being
  obscured, handles scaled grids whose line spacing alternates by one pixel,
  and excludes trailing legend lines from rectangular patterns.
- The OCR probe sanitizes only its console display name so unsupported filename
  characters do not interrupt local validation.
- The on-screen recognition view now overlays pending-review rectangles on the
  uploaded source image instead of showing a reconstructed grid in its place.
- The recognition and COCO redraw previews keep the full-screen review mode
  available while giving each preview independent zoom and drag controls.
- The recognition preview can toggle pending-review markers on or off over the
  uploaded source image.
- Source-image review markers now wait for the uploaded image dimensions before
  rendering, preventing the grid overlay from stretching into the legend and
  color-count area while the image is still loading or cached.
- Located cells are centered with measured preview dimensions, and detailed
  review zoom can reach 800%.
- The correction queue is height-limited with its own scroll area; each review
  card can locate the cell, confirm the suggested mapping, or choose from
  nearest target-color candidates.
- Imports show staged progress, and a floating palette reference switches
  between colors used in the current project and every available mapping.
