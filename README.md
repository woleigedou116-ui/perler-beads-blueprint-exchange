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
