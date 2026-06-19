# 拼豆图纸标准转换工具

这是一个本地运行的拼豆图纸转换工具，用来把带 `MARD` 色号的规则网格图纸转换成可校对、可导出的 `COCO` 图纸项目。

图片、项目文件和识别结果都在本机处理，不会上传到远程服务。

本项目是一个 vibecoding 作品。如果使用中遇到问题，欢迎联系：`1165756084@qq.com`。

## 当前版本

当前推荐测试版：

```text
v0.1.1-mvp-test
```

Windows 便携包可在 GitHub Releases 中下载：

```text
perler-beads-blueprint-exchange-v0.1.1-mvp-test-windows-portable.zip
```

这是 MVP 测试版，适合试用核心流程和反馈问题，不是正式安装器。

## 能做什么

- 上传本地图纸图片并识别规则网格。
- 将 `MARD` 色号转换为 `COCO` 色号。
- 按来源色号和目标色号分组校对待确认结果。
- 支持整组确认、整组候选修改和单格手动修正。
- 支持单格和框选区域标记为非拼豆。
- 支持查看 MARD 原图叠加视图和 COCO 重绘预览。
- 支持隐藏 COCO 色号，查看更接近烫完后的成品效果。
- 支持保存、重新打开 `.beadproject` 项目文件。
- 支持导出 CSV、干净图、叠加图和项目文件。

## 使用方式

1. 下载 Windows 便携包。
2. 解压整个文件夹。
3. 双击 `拼豆图纸转换工具.exe`，或双击 `启动工具.bat`。
4. 等待浏览器自动打开。
5. 上传图纸图片，完成识别和校对。

如果浏览器没有自动打开，可以查看启动窗口里的本地地址，通常是：

```text
http://127.0.0.1:8765/
```

请不要只复制 exe 单独运行。便携包需要保留同一文件夹里的 `_internal` 目录和说明文件。

## 导出内容

完成识别和校对后，可以导出：

- `mapping.csv`：来源色号、目标色号和数量清单。
- `clean.png`：干净重绘的 COCO 图纸。
- `overlay.png`：带疑点高亮的原图检查视图。
- `project.beadproject`：可重新打开的本地项目文件。

存在待确认格子时，界面会在导出前提示风险。

## 已知限制

- 当前主要面向规则网格图纸。
- 大面积水印、低清、拍歪或花体数字仍可能产生较多校对项。
- 当前版本优先保证无水印和轻水印图纸的基础转换流程。
- 水印区域自动降噪、跳过或更精细的不确定性策略放入后续版本。
- 当前仍是浏览器界面的本地工具，后续可演进为独立桌面软件界面。

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

打开本地地址后即可上传规则网格图片、校对 `MARD -> COCO` 转换结果，并下载导出文件：

```text
http://localhost:8765
```

## 打包

Windows 便携包使用 PyInstaller 构建：

```powershell
cd apps\web
npm run build
cd ..\..
.\.venv\Scripts\pyinstaller scripts\perler_beads_desktop.spec --noconfirm --clean
```

打包规则会只收录运行所需的 OCR 模型和静态资源，避免把未使用的 OCR 模型或视频 DLL 放进包内。

## 本地资料

`拼豆样例图/` 与 `标准对应转换/` 是本地验收和人工核对用资料，已被忽略，不随代码提交。

应用运行时使用经人工核对并版本化的色号表：

```text
data/palettes/mard-coco.v1.json
```

## OCR 评测

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

默认输出到 `.data\ocr-benchmark\rapidocr-summary.csv` 和 `.json`，包含每张图的网格尺寸、待复核数量、复核原因、常见原始 OCR 文本、目标色号统计和耗时。

只评测文件名包含指定文字的样例，或试跑水印/低清图预处理策略：

```powershell
.\.venv\Scripts\python scripts\ocr_benchmark.py ..\..\拼豆样例图 --name-contains 水印 --preprocess contrast-sharpen
```

目前 `--preprocess` 支持 `none`、`autocontrast`、`sharpen`、`contrast-sharpen`、`grayscale-contrast`。默认只把预处理图用于 OCR 小格裁剪，网格检测和颜色采样仍使用原图；如需复现实验中的整图预处理，可加 `--preprocess-scope full`。

还可以试跑较慢的水印/低清小格 OCR profile：

```powershell
.\.venv\Scripts\python scripts\ocr_benchmark.py ..\..\拼豆样例图 --name-contains 水印 --ocr-profile watermark
```

可选使用 Tesseract 白名单模式跑同一批样例：

```powershell
.\.venv\Scripts\python scripts\ocr_benchmark.py ..\..\拼豆样例图 --engine tesseract
```

如果本机未安装 `tesseract`，报告会标记为 `engine-unavailable:tesseract`。安装后可通过 `--tesseract-command` 指定可执行文件路径。

## 设计文档

首版设计与实施范围见：

- `docs/superpowers/specs/2026-05-26-perler-bead-standard-converter-design.md`
- `docs/superpowers/plans/2026-05-26-perler-bead-standard-converter-mvp.md`

前端重构和桌面软件式界面的长期规范见：

- `docs/frontend/frontend-architecture-source-of-truth.md`
- `docs/frontend/frontend-skeleton-acceptance.md`

后续调整前端 UI、视觉风格、目录结构、token、主题或多语言设计时，优先以这份前端真源文档为准，避免只改局部界面导致整体方向跑偏。
