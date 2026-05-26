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
```

后端与完整工作台仍在开发中。首版设计与实施范围见：

- `docs/superpowers/specs/2026-05-26-perler-bead-standard-converter-design.md`
- `docs/superpowers/plans/2026-05-26-perler-bead-standard-converter-mvp.md`

## 本地资料

`拼豆样例图/` 与 `标准对应转换/` 是本地验收和人工核对用资料，已被忽略，不随代码提交。后续进入应用的映射数据会以经过核对的结构化版本单独保存。
