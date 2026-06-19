# 后端加固任务清单（交付给 codex）

> 背景：对 `feature/mard-coco-mvp` 分支的一次整体审查结论。下列均为**健壮性/安全/工程加固**，不是"现在就崩"的 bug——项目当前能正常运行。但其中 #1 是真实安全隐患，建议优先。
>
> 基准 commit：`9f228ee`。所有行号以该 commit 的 `apps/api/src/bead_converter/` 为准。
>
> 数据文件 `data/palettes/mard-coco.v1.json` 的 `reviewedFrom` 文案已另行修正，不在本清单内。

---

## #1 路径遍历：`project_id` 未校验就拼进文件系统路径 【优先级：高】

**问题**

`projects/store.py` 直接用调用方传入的 `project_id` 拼接磁盘路径，没有任何格式校验：

- `store.py:24` `folder = self.root / project_id`（save_source_image）
- `store.py:31` `(self.root / project_id / "project.json").read_text(...)`（load）
- `store.py:35` `(self.root / project_id).glob("source.*")`（source_image_path）

而路由层 `routes/projects.py` 对路径参数 `project_id` 也没有任何校验（`get_project`、`get_source_image`、各 `exports/*`、各 `cells`/`mappings` patch 端点都用 `_project(request, project_id)` → `store.load(project_id)`）。

自己创建的项目 id 是 `uuid4().hex`（安全），但这些 GET/PATCH 端点接受**任意字符串**。构造形如 `..%2f..%2f...` 的 `project_id` 理论上可让 `self.root / project_id` 逃出数据目录，读到目录外的 `project.json`/`source.*`。

**缓解因素**：应用只监听 `127.0.0.1`（见 `desktop_launcher.py`），是本地单机应用，攻击面有限。但修复成本极低，且能顺带覆盖 #4 的一半。

**建议解法**

新增一个集中校验函数，要求 `project_id` 必须是 32 位十六进制（匹配 `uuid4().hex` 的格式），不符合就抛 404/422。两个位置都加，双保险：

```python
# store.py（最贴近文件操作，最该挡的地方）
import re
_PROJECT_ID_RE = re.compile(r"^[0-9a-f]{32}$")

def _safe_project_dir(self, project_id: str) -> Path:
    if not _PROJECT_ID_RE.fullmatch(project_id):
        raise ValueError(f"invalid project id: {project_id!r}")
    return self.root / project_id
```

让 `save_source_image` / `load` / `source_image_path` / `export_archive` 都改用 `self._safe_project_dir(project_id)`。在 `routes/projects.py` 的 `_project()` 里把 store 抛出的 `ValueError` 映射成 `HTTPException(404, "项目不存在")`（与现有 `FileNotFoundError` 处理一致，避免泄露内部细节）。

**验收**

- 新增测试：`project_id="../foo"`、含 `/`、含 `\`、空串、非 hex 字符串 → 返回 404，且不触碰数据目录外的文件。
- 现有正常 uuid 流程的测试全部仍通过。

---

## #2 `.beadproject` 导入：归档体量无上限（解压炸弹风险）【优先级：中】

**问题**

`store.py:49 import_archive` 打开用户上传的 zip 项目文件。**路径遍历防护已做得很好**（`store.py:57-58` 用 `Path(name).name == name and name.startswith("source.")` 过滤条目，这一点保留）。但没有对以下任何一项设上限：

- 整个 zip 解压后的总字节数
- `project.json` 的大小
- `source.*` 图片的字节数
- 反序列化后 `cells` 的数量

一个恶意或损坏的 `.beadproject`（高压缩比的解压炸弹，或声明超大网格的 JSON）可在 `bundle.read(...)` / `model_validate_json(...)` 阶段撑爆内存。

**建议解法**

在 `import_archive` 里读取前先检查 `ZipInfo.file_size`（声明的解压后大小）与压缩比，超过阈值直接拒绝；读取后对 `len(project.cells)` 设上限（一个合理上限可参考首版支持的最大网格，例如 200×200 = 4 万格，留余量取 10 万）。超限统一抛 `ValueError` → 路由层已把它映射为 `422 "无法打开项目文件"`（见 `routes/projects.py:218-219`），无需改路由。

```python
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024      # 单个解压条目上限
MAX_CELLS = 100_000
# 读取前：for info in bundle.infolist(): if info.file_size > MAX_ARCHIVE_BYTES: raise ValueError(...)
# 反序列化后：if len(project.cells) > MAX_CELLS: raise ValueError(...)
```

**验收**

- 构造一个声明超大解压尺寸的 zip → 返回 422，不发生内存暴涨。
- 正常 `.beadproject` 往返（export→open）测试仍通过（参考现有 `test_project_store.py`）。

---

## #3 `.beadproject` 导入会用归档自带 id 覆盖本地同 id 项目【优先级：中】

**问题**

`store.py:67-68`：`import_archive` 反序列化后直接 `self.save(project)`，而 `save` 用的是**归档文件里自带的 `project.id`**（`store.py:13 folder = self.root / project.id`）。

后果：

1. 导入一个 id 与本地已有项目相同的 `.beadproject`，会**静默覆盖**本地那个项目，无任何提示。
2. 归档里的 `project.id` 是外部可控字符串，又回到 #1 的路径问题——这是 #1 校验必须覆盖到 `save` 的原因。

**建议解法**

导入时重新生成 id，把它当作"新建项目"而非"恢复原项目"：

```python
# import_archive 内，save 之前：
from uuid import uuid4
project = project.model_copy(update={"id": uuid4().hex})
```

（注意：`save_source_image(project.id, ...)` 也要用新 id，保证图片与 json 落在同一新目录。）

如果产品上希望"重新打开同一项目时保持 id 不变以便续编"，则改为：保留 id，但必须先经过 #1 的格式校验，并在覆盖前作出明确决策（覆盖/另存）。**推荐前者（重新生成 id）**，最简单且无歧义，符合"打开 = 导入一份副本"的本地工具心智模型。

**验收**

- 导入两次同一个 `.beadproject` → 得到两个独立项目（id 不同），互不覆盖。
- 导入后能正常读取、其 `source.*` 图片在新 id 目录下存在。

---

## #4 OCR 引擎首次调用阻塞首个上传请求【优先级：中（体验）】

**问题**

`routes/projects.py:165-168`：`RapidOcrProvider()` 在第一次上传请求处理过程中懒加载初始化。首张图上传会同步等待模型加载（约 700ms，可在响应头 `X-Bead-Timing` 的 `ocr_init_ms` 看到）。功能正确，纯首次延迟体验问题。

**建议解法**

在应用启动后用后台线程预热 OCR，使首个真实请求到来时引擎已就绪。可在 `main.py:create_app` 注册 FastAPI startup 事件（或 lifespan）里，起一个 daemon 线程执行 `RapidOcrProvider()` 并赋给 `application.state.ocr`；保留请求里"若仍为 None 则同步初始化"的兜底逻辑，避免预热未完成时出错。

注意不要破坏现有可测试性：`create_app(ocr_provider=...)` 注入自定义 provider 的路径要继续生效（测试依赖它）——预热只在 `ocr_provider is None` 时进行。

**验收**

- 注入 fake provider 的现有测试不受影响（不应触发真实 RapidOCR 加载）。
- 手动验证：服务启动数秒后上传第一张图，`ocr_init_ms` 明显下降或为 0。

---

## #5 缺少 CI【优先级：中（工程）】

**问题**

后端测试约 1571 行（`apps/api/tests/`），前端 16 个 vitest 测试文件，`pyproject.toml` 已配好 pytest + pytest-cov，`apps/web` 已配好 vitest。但仓库没有 `.github/workflows/`，这些测试不会自动运行，回归无人把守。

**建议解法**

新增一个 GitHub Actions workflow（`.github/workflows/ci.yml`），在 push / PR 时跑两个 job：

- **backend**：装 Python 3.10+ 与 `pip install -e ".[dev]"`，运行 `pytest`。
  - 注意 `rapidocr`/`onnxruntime` 较重，若拖慢 CI，可考虑给依赖加缓存，或确认测试是否都用 fake/注入 provider 而无需真实模型（看起来大部分是——确认后可不装重依赖跑核心测试）。
- **frontend**：`apps/web` 下 `npm ci && npm test -- --run`（vitest 单次运行）。

**验收**

- workflow 在 PR 上自动触发，两个 job 均绿。

---

## 修复顺序建议

1. **#1**（安全，最廉价，顺带覆盖 #3 的路径面）
2. **#3**（与 #1 同属 store 的 id/路径问题，一起改上下文连贯）
3. **#2**（同样在 `import_archive`，可与 #3 一并处理）
4. **#5**（一次性投入，之后所有改动都有测试守护——也可以最先做，让后续 #1/#2/#3 的新测试直接进 CI）
5. **#4**（纯体验优化，最后）

## 通用要求

- 每项都补对应单元测试；改完 `pytest` 全绿。
- 不改动前端正在迭代的预览相关文件，避免与进行中的工作冲突。
- 这些是加固，不改变现有正常流程的行为与 API 形状。
