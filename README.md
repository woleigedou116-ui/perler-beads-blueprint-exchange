# 拼豆图纸标准转换

本项目将带可读 `MARD` 色号的规则拼豆图纸转换为可校对、可导出的 `COCO` 图纸项目。应用在本机运行，上传图片与项目文件不会发送到远程服务。

## 开发环境

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
cd apps\web
npm install
npm test -- --run
npm run build
cd ..\..
.\.venv\Scripts\python scripts\dev.py
```

打开 `http://localhost:8765` 即可上传规则网格图片、校对 `MARD -> COCO` 转换结果，并下载：

- `mapping.csv`：来源、目标色号和数量清单。
- `clean.png`：干净重绘的 COCO 图纸。
- `overlay.png`：带疑点高亮的原图检查视图。
- `project.beadproject`：可重新打开的本地项目文件。

存在待确认格子时界面会在导出前提示风险；图纸和项目内容始终仅由本机服务处理。

首版设计与实施范围见：

- `docs/superpowers/specs/2026-05-26-perler-bead-standard-converter-design.md`
- `docs/superpowers/plans/2026-05-26-perler-bead-standard-converter-mvp.md`

## 本地资料

`拼豆样例图/` 与 `标准对应转换/` 是本地验收和人工核对用资料，已被忽略，不随代码提交。应用运行时使用经人工核对并版本化的 `data/palettes/mard-coco.v1.json`。

在项目主目录验收 OCR 探针：

```powershell
.\.venv\Scripts\python scripts\ocr_probe.py 拼豆样例图
```

若从 `.worktrees/feature-mard-coco-mvp` 继续开发，样例仍保留在主目录，使用：

```powershell
.\.venv\Scripts\python scripts\ocr_probe.py ..\..\拼豆样例图
```

批量评测当前 OCR 转换链路：

```powershell
.\.venv\Scripts\python scripts\ocr_benchmark.py ..\..\拼豆样例图
```

默认输出到 `.data\ocr-benchmark\rapidocr-summary.csv` 和 `.json`，包含每张图的网格尺寸、待复核数量、复核原因、常见原始 OCR 文本、目标色号统计和耗时。后续接入 PaddleOCR、Tesseract 等候选引擎时，用同一份样例跑报告即可横向比较。

只评测文件名包含指定文字的样例，或试跑水印/低清图预处理策略：

```powershell
.\.venv\Scripts\python scripts\ocr_benchmark.py ..\..\拼豆样例图 --name-contains 水印 --preprocess contrast-sharpen
```

目前 `--preprocess` 支持 `none`、`autocontrast`、`sharpen`、`contrast-sharpen`、`grayscale-contrast`。默认只把预处理图用于 OCR 小格裁剪，网格检测和颜色采样仍使用原图；如需复现实验中的整图预处理，可加 `--preprocess-scope full`。这些策略只用于评测，不会改变应用里的正式识别流程；带预处理的报告会输出到类似 `.data\ocr-benchmark\rapidocr-contrast-sharpen-ocr-summary.csv`。

还可以试跑较慢的水印/低清小格 OCR profile，它会对每个小格尝试多种只用于读字的版本：

```powershell
.\.venv\Scripts\python scripts\ocr_benchmark.py ..\..\拼豆样例图 --name-contains 水印 --ocr-profile watermark
```

可选使用 Tesseract 白名单模式跑同一批样例：

```powershell
.\.venv\Scripts\python scripts\ocr_benchmark.py ..\..\拼豆样例图 --engine tesseract
```

如果本机未安装 `tesseract`，报告会标记为 `engine-unavailable:tesseract`。安装后可通过 `--tesseract-command` 指定可执行文件路径。
