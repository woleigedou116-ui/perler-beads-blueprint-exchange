# MVP Sample Acceptance Checklist

Date: 2026-05-27

## Scope

The implementation plan identified four local reference images in `拼豆样例图/`.
Those four images remain the acceptance scope below. During verification, two
additional ignored local images were present in that directory; their probe
results are recorded separately and they are not included in the committed
application assets.

## Verification

- Backend: `.\.venv\Scripts\python -m pytest -q` passed with 37 tests.
- Frontend: Vitest passed with 5 tests; TypeScript checking and Vite build passed.
- Hosted UI: the built app was opened at `http://127.0.0.1:8765`; the upload,
  local-processing notice, review area, and `.beadproject` open input were visible.
- OCR probe: `.\.venv\Scripts\python scripts\ocr_probe.py ..\..\拼豆样例图`
  runs safely with Windows console-compatible filenames.

## Planned Four Samples

The "manual correction/export" column records that exports remain available
with risk warnings and that the saved project can be reopened; fully resolving
every review cell was not necessary for this acceptance pass.

| 样例文件 | 网格检测结果 | OCR 自动确认格数 / 30 格抽样命中 | 待确认格数 | 手动校正后可导出 | 备注 |
| --- | --- | ---: | ---: | --- | --- |
| `Camera_1040g3k031uui79pdii005q1lk2cmr1strkjq910.jpg` | `40 x 63` | `1180 / 27` | `175` | 是，四类导出 `200`，项目重开 `201` | 修复前图例横线会被误识别为额外行 |
| `Camera_1040g3k831vntl89sig305p14d3fah7q4bm44fjg.jpg` | `37 x 37` | `212 / 29` | `785` | 是，四类导出 `200`，项目重开 `201` | 未确认格以风险响应头保留 |
| `Camera_1040g3k831vntl89sig3g5p14d3fah7q4g89tpvo.jpg` | `37 x 37` | `136 / 29` | `861` | 是，四类导出 `200`，项目重开 `201` | 未确认格以风险响应头保留 |
| `有水印版.jpg` | `50 x 50` | `293 / 14` | `2181` | 是，四类导出 `200`，项目重开 `201` | 水印图按设计进入大量人工校对 |

## Additional Local Probe Inputs

These ignored files appeared in the local sample directory after the original
four-file plan was written. They were probed only to ensure the diagnostic
command remains usable with the current disk contents.

| 本地附加文件 | 网格检测结果 | 30 格抽样 OCR 命中 | 备注 |
| --- | --- | ---: | --- |
| `拼豆日记📖No.13_3_雪芙_来自小红书网页版.jpg` | `30 x 36` | `21` | 文件名包含控制台不一定支持的符号 |
| `洛克王国｜恶魔狼_2_玉米大盗_来自小红书网页版_有水印.jpg` | `48 x 48` | `13` | 水印素材，仅记探针结果 |

## Acceptance Fixes

- Grid recovery now tolerates a little over half of periodic lines being
  obscured, handles scaled grids whose line spacing alternates by one pixel,
  and excludes trailing legend lines from rectangular patterns.
- The OCR probe sanitizes only its console display name so unsupported filename
  characters do not interrupt local validation.
