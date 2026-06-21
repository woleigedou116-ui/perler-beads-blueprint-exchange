# 前端任务：消除滚轮缩放时的瞬时模糊

> 交付给 codex。基准 commit：`9f228ee`（含 `97e7ab7`/`422e6de` 之后的最新状态）。
> 涉及文件：`apps/web/src/features/workbench/ComparisonPreview.tsx`（及其测试）。
> 这是体验优化，不改变 API 与数据流，不应触碰后端。

---

## 问题

放大预览图时会"模糊一下"再变清晰。

**根因**：预览是 SVG 矢量渲染（`GridPreview.tsx` 的 `.preview-transform` 上用 `transform: scale()`）。`9f228ee`（defer zoom commits）为了缩放流畅，给缩放交互加了延迟提交：

- 缩放发生时，先只改 DOM 的 `content.style.transform`（`ComparisonPreview.tsx` `scheduleTransformWrite` / `applyTransform`），浏览器把**当前帧位图直接拉大** → 视觉上模糊。
- 同时起一个 `ZOOM_COMMIT_DELAY_MS = 150`（`ComparisonPreview.tsx:72`）的定时器，停手 150ms 后 `commitZoomInteraction`（:429）才 `setViews` 触发 React 重渲染，SVG 按新比例重新栅格化 → 恢复清晰。

所以"模糊一下" = 交互期间位图拉伸（糊）→ 150ms 后矢量重绘（清晰）的过渡。

**关键观察**：这条延迟路径目前**滚轮和触控捏合共用**：
- 滚轮：`handleWheel`(:471) → `previewZoom`(:444) → `previewZoomTo`(:451)
- 捏合：`handlePointerMove`(:561) → `previewZoomTo`(:561)

而按钮 `+/-` 走的是 `changeZoom`(:419)，**直接 `setViews` 同步提交，本来就不模糊**。

## 方案（B：按输入类型区分提交时机）

- **滚轮缩放**：改为**立即提交**（走同步 `setViews` 重渲染，等价于现在按钮 `changeZoom` 的路径）。滚轮是离散步进（每次 `ZOOM_STEP=0.25`，范围 1–8，至多约 28 步），桌面是主场景，立即重渲染不会造成明显卡顿，且预览已做虚拟化（`previewVirtualization.ts` 只渲染可见格），重渲染成本可控。这样滚轮缩放**不再有模糊**。
- **触控捏合**：**保留**现有延迟提交（`previewZoomTo` + 150ms commit）。捏合是连续手势，需要 CSS scale 的流畅过渡，延迟提交对它是合理的。

即：把"延迟提交"限定为捏合专用，滚轮回到同步路径。

## 实现建议

1. 让 `handleWheel`(:471) 不再调用 `previewZoom`(走延迟)，而是走同步提交。最简单是直接复用现有的 `changeZoom(side, delta)`(:419)——它已经用 `zoomAroundViewportCenter` 且直接 `setViews`，行为与按钮一致：

   ```ts
   function handleWheel(side: PreviewSide, event: WheelEvent<HTMLDivElement>) {
     event.preventDefault();
     event.stopPropagation();
     updateViewportSize(side, true); // commit=true 确保重渲染用的 viewportSize 是最新的
     changeZoom(side, event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
   }
   ```

   - 注意：现在 `handleWheel` 调的是 `updateViewportSize(side)`（commit=false，只更新 ref）。改走同步重渲染后，建议传 `commit=true`，让 `viewportSizes` state 同步更新，避免重渲染时虚拟化用到过期视口尺寸。请确认 `changeZoom` 重渲染依赖的 `viewportSize` 来源（`ComparisonPreview.tsx:752/778` 传给 GridPreview 的 `viewportSize`）拿到的是最新值。

2. **`previewZoom`(:444) 若仅被滚轮使用，可一并移除**，避免留下死代码。先 grep 确认它没有别的调用方（捏合走的是 `previewZoomTo`，不是 `previewZoom`）。`previewZoomTo` / `commitZoomInteraction` / `zoomInteractions` 等延迟机制**保留**给捏合。

3. 不要动 `scheduleTransformWrite` 的**平移**用途——平移（`handlePointerMove` 拖拽分支 :580）仍然依赖它做流畅的 rAF 写入，这部分不变。

4. **可选**（codex 判断）：若担心快速连续滚轮触发过多重渲染，可对滚轮缩放加一层 rAF 节流——但**关键是提交的是真实 zoom（setViews），不是 CSS 位图拉伸**，这样就不会模糊。除非实测有卡顿，否则不必加，避免过度设计。

## 验收标准

- **滚轮放大/缩小预览，不再出现先模糊后清晰的过渡**；缩放后即清晰。
- 触控捏合缩放行为不变（仍流畅，松手后清晰）。
- 平移（拖拽）流畅度不变。
- 按钮 `+/-`、`重置`、聚焦定位（focusRequest）等现有缩放相关行为不回归。
- 缩放百分比显示（`:627`）随滚轮即时更新。

## 测试要求

- 更新/新增 `ComparisonPreview.test.tsx`：
  - 断言**滚轮事件后 `views[side].zoom` 同步更新**（即 setViews 已提交，而非仅改 DOM style）。可参考现有测试里对缩放/transform 的断言方式。
  - 保留并确认**捏合仍走延迟提交**的测试（捏合后在 commit delay 前 `views` 未变、delay 后变）。若现有测试是针对滚轮写的延迟行为，需相应调整为捏合。
- `previewVirtualization.test.ts` 应继续通过（虚拟化逻辑不变）。
- 跑 `cd apps/web && npm test -- --run` 全绿。

## 备注

- 不改后端、不改 `data/`、不改 CI。
- 若发现 `previewZoom` 还有其他调用方导致不能简单移除，保留它即可，重点是 `handleWheel` 走同步提交。
