import {
  Download,
  EyeOff,
  FolderOpen,
  Frame,
  Maximize2,
  RotateCcw,
  Save,
} from "lucide-react";

import { Button } from "../../shared/ui";
import { DesktopShellLayout } from "../../widgets/app-shell";
import { ThreePaneWorkspace } from "../../widgets/workspace-layout";
import "./desktop-ui-prototype.css";

const reviewItems = [
  { source: "MARD H2", target: "COCO A01", count: 286, tone: "warn" },
  { source: "MARD H1", target: "COCO A02", count: 201, tone: "soft" },
  { source: "MARD D6", target: "COCO J11", count: 71, tone: "accent" },
  { source: "MARD B7", target: "COCO B09", count: 42, tone: "dark" },
];

const paletteStats = [
  ["A01", 301, "#fff8ef"],
  ["A02", 201, "#f9ead8"],
  ["B09", 267, "#0f1112"],
  ["J03", 129, "#e3d5f1"],
  ["J11", 71, "#9c71da"],
  ["H29", 17, "#38acc4"],
  ["L13", 44, "#4f4d45"],
  ["S15", 19, "#8c7cd8"],
];

const beadRows = Array.from({ length: 13 }, (_, row) =>
  Array.from({ length: 18 }, (_, column) => {
    const center = Math.abs(row - 6) + Math.abs(column - 8);
    if (center < 4) return "cream";
    if ((row + column) % 11 === 0) return "violet";
    if (row > 8 && column > 12) return "dark";
    if (row < 3 && column > 10) return "purple";
    if (row > 5 && column < 4) return "cyan";
    return (row + column) % 4 === 0 ? "sand" : "empty";
  }),
);

function MiniBeadMap({ variant }: { variant: "source" | "target" }) {
  return (
    <div className={`prototype-bead-map prototype-bead-map-${variant}`} aria-hidden="true">
      {beadRows.flatMap((row, rowIndex) =>
        row.map((color, columnIndex) => (
          <span
            className={`prototype-bead-cell prototype-bead-${color}`}
            key={`${rowIndex}-${columnIndex}`}
          >
            {variant === "target" && color !== "empty" ? labelFor(color) : null}
          </span>
        )),
      )}
    </div>
  );
}

function labelFor(color: string) {
  if (color === "cream") return "A01";
  if (color === "sand") return "H2";
  if (color === "violet") return "J11";
  if (color === "cyan") return "H29";
  if (color === "dark") return "B09";
  if (color === "purple") return "J03";
  return "";
}

export function DesktopUiPrototype() {
  const topBar = (
    <div className="prototype-topbar">
      <div className="prototype-brand">
        <span className="prototype-logo-mark" aria-hidden="true" />
        <div>
          <strong>拼豆图纸转换工具</strong>
          <span>MARD 转 COCO / 本地项目</span>
        </div>
      </div>
      <nav className="prototype-topnav" aria-label="工作台视图">
        <Button className="prototype-tab prototype-tab-active" size="sm" variant="ghost">
          转换
        </Button>
        <Button className="prototype-tab" size="sm" variant="ghost">
          校对
        </Button>
        <Button className="prototype-tab" size="sm" variant="ghost">
          导出
        </Button>
      </nav>
      <div className="prototype-top-actions">
        <Button size="sm">
          <FolderOpen size={15} />
          打开项目
        </Button>
        <Button size="sm">
          <Save size={15} />
          保存
        </Button>
        <Button size="sm" variant="primary">
          <Download size={15} />
          导出
        </Button>
      </div>
    </div>
  );

  const leftRail = (
    <div className="prototype-left-rail">
      <section className="prototype-panel prototype-project-card">
        <div className="prototype-section-title">
          <h2>项目</h2>
          <span>本地处理</span>
        </div>
        <div className="prototype-file-drop">
          <div className="prototype-source-thumb">
            <MiniBeadMap variant="source" />
          </div>
          <strong>恶魔狼.jpg</strong>
          <span>48 x 48 / MARD</span>
        </div>
        <div className="prototype-field-grid">
          <label>
            来源标准
            <select defaultValue="MARD">
              <option>MARD</option>
            </select>
          </label>
          <label>
            目标标准
            <select defaultValue="COCO">
              <option>COCO</option>
            </select>
          </label>
        </div>
        <Button className="prototype-recognize" variant="primary">
          重新识别
        </Button>
      </section>

      <section className="prototype-panel">
        <div className="prototype-section-title">
          <h2>流程</h2>
          <span>3 / 5</span>
        </div>
        <ol className="prototype-steps">
          <li className="done">上传图纸</li>
          <li className="done">识别网格</li>
          <li className="active">校对色号</li>
          <li>保存项目</li>
          <li>导出文件</li>
        </ol>
      </section>
    </div>
  );

  const workspace = (
    <section className="prototype-workspace" aria-label="预览工作区">
      <div className="prototype-workspace-toolbar">
        <div>
          <h1>图纸校对</h1>
          <span>待确认 770 格 / 35 组</span>
        </div>
        <div className="prototype-tool-group">
          <Button size="sm">
            <Frame size={15} />
            框选非拼豆
          </Button>
          <Button size="sm">
            <EyeOff size={15} />
            隐藏色号
          </Button>
          <Button size="sm">
            <Maximize2 size={15} />
            全屏
          </Button>
        </div>
      </div>

      <div className="prototype-preview-grid">
        <article className="prototype-preview-panel">
          <div className="prototype-preview-heading">
            <div>
              <h2>识别叠加视图</h2>
              <span>MARD / 200%</span>
            </div>
            <div className="prototype-zoom-controls">
              <Button aria-label="缩小识别叠加视图" size="icon">
                -
              </Button>
              <Button size="sm">
                <RotateCcw size={14} />
                重置
              </Button>
              <Button aria-label="放大识别叠加视图" size="icon">
                +
              </Button>
            </div>
          </div>
          <div className="prototype-preview-stage prototype-source-stage">
            <MiniBeadMap variant="source" />
            <span className="prototype-selection-ring prototype-selection-a" />
            <span className="prototype-selection-ring prototype-selection-b" />
          </div>
        </article>

        <article className="prototype-preview-panel">
          <div className="prototype-preview-heading">
            <div>
              <h2>COCO 重绘预览</h2>
              <span>目标图 / 225%</span>
            </div>
            <div className="prototype-zoom-controls">
              <Button aria-label="缩小 COCO 重绘预览" size="icon">
                -
              </Button>
              <Button size="sm">
                <RotateCcw size={14} />
                重置
              </Button>
              <Button aria-label="放大 COCO 重绘预览" size="icon">
                +
              </Button>
            </div>
          </div>
          <div className="prototype-preview-stage">
            <MiniBeadMap variant="target" />
            <span className="prototype-target-crosshair" />
          </div>
        </article>
      </div>

      <section className="prototype-panel prototype-palette-strip" aria-label="当前用色">
        {paletteStats.map(([code, count, color]) => (
          <Button className="prototype-swatch-pill" key={code} size="sm">
            <span style={{ background: color }} />
            <strong>{code}</strong>
            <em>{count}</em>
          </Button>
        ))}
      </section>
    </section>
  );

  const rightRail = (
    <div className="prototype-right-rail">
      <section className="prototype-panel prototype-review-panel">
        <div className="prototype-section-title">
          <h2>校对</h2>
          <span>待确认 35 组</span>
        </div>
        <div className="prototype-review-list">
          {reviewItems.map((item, index) => (
            <article className={`prototype-review-card tone-${item.tone}`} key={item.source}>
              <div>
                <strong>{item.source}</strong>
                <strong>{item.target}</strong>
                <span>涉及 {item.count} 格</span>
              </div>
              <div className="prototype-card-actions">
                <Button size="sm">定位</Button>
                <Button size="sm">确认</Button>
                <Button size="sm" variant={index === 0 ? "primary" : "default"}>
                  修改
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="prototype-panel prototype-inspector">
        <div className="prototype-section-title">
          <h2>选中格</h2>
          <span>2, 18</span>
        </div>
        <label>
          来源色号
          <input defaultValue="D6" />
        </label>
        <label>
          目标色号
          <input defaultValue="J11" />
        </label>
        <Button>修正选中格</Button>
      </section>
    </div>
  );

  const statusBar = (
    <div className="prototype-statusbar">
      <span>本地服务正常</span>
      <span>最近识别 7.3 秒</span>
      <span>自动定位已开启</span>
      <span>项目未上传到远程服务</span>
    </div>
  );

  return (
    <DesktopShellLayout
      ariaLabel="桌面工作台视觉模型"
      body={
        <ThreePaneWorkspace
          center={workspace}
          className="prototype-body"
          left={leftRail}
          right={rightRail}
        />
      }
      className="prototype-shell"
      statusBar={statusBar}
      topBar={topBar}
    />
  );
}
