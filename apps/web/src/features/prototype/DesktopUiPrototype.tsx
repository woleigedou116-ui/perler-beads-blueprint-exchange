import {
  Download,
  EyeOff,
  FolderOpen,
  Frame,
  Maximize2,
  RotateCcw,
  Save,
} from "lucide-react";

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
  return (
    <main className="prototype-shell" aria-label="桌面工作台视觉模型">
      <header className="prototype-topbar">
        <div className="prototype-brand">
          <span className="prototype-logo-mark" aria-hidden="true" />
          <div>
            <strong>拼豆图纸转换工具</strong>
            <span>MARD 转 COCO / 本地项目</span>
          </div>
        </div>
        <nav className="prototype-topnav" aria-label="工作台视图">
          <button className="prototype-tab prototype-tab-active">转换</button>
          <button className="prototype-tab">校对</button>
          <button className="prototype-tab">导出</button>
        </nav>
        <div className="prototype-top-actions">
          <button>
            <FolderOpen size={15} />
            打开项目
          </button>
          <button>
            <Save size={15} />
            保存
          </button>
          <button className="prototype-primary">
            <Download size={15} />
            导出
          </button>
        </div>
      </header>

      <section className="prototype-body">
        <aside className="prototype-left-rail" aria-label="项目面板">
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
            <button className="prototype-recognize">重新识别</button>
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
        </aside>

        <section className="prototype-workspace" aria-label="预览工作区">
          <div className="prototype-workspace-toolbar">
            <div>
              <h1>图纸校对</h1>
              <span>待确认 770 格 / 35 组</span>
            </div>
            <div className="prototype-tool-group">
              <button>
                <Frame size={15} />
                框选非拼豆
              </button>
              <button>
                <EyeOff size={15} />
                隐藏色号
              </button>
              <button>
                <Maximize2 size={15} />
                全屏
              </button>
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
                  <button>-</button>
                  <button>
                    <RotateCcw size={14} />
                    重置
                  </button>
                  <button>+</button>
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
                  <button>-</button>
                  <button>
                    <RotateCcw size={14} />
                    重置
                  </button>
                  <button>+</button>
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
              <button className="prototype-swatch-pill" key={code}>
                <span style={{ background: color }} />
                <strong>{code}</strong>
                <em>{count}</em>
              </button>
            ))}
          </section>
        </section>

        <aside className="prototype-right-rail" aria-label="校对面板">
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
                    <button>定位</button>
                    <button>确认</button>
                    <button className={index === 0 ? "prototype-primary" : ""}>修改</button>
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
            <button>修正选中格</button>
          </section>
        </aside>
      </section>

      <footer className="prototype-statusbar">
        <span>本地服务正常</span>
        <span>最近识别 7.3 秒</span>
        <span>自动定位已开启</span>
        <span>项目未上传到远程服务</span>
      </footer>
    </main>
  );
}
