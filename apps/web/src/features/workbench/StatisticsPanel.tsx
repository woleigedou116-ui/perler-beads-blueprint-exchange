import type { BeadProject } from "../../domain/types";

interface StatisticsPanelProps {
  project: BeadProject;
  onExport: (
    kind: "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject",
  ) => void;
}

export function StatisticsPanel({ project, onExport }: StatisticsPanelProps) {
  const counts = project.cells.reduce<Record<string, number>>((result, cell) => {
    if (cell.target_code && cell.status !== "empty") {
      result[cell.target_code] = (result[cell.target_code] ?? 0) + 1;
    }
    return result;
  }, {});

  return (
    <section className="stats-panel" aria-label="统计与导出">
      <div className="chips">
        {Object.entries(counts).map(([code, count]) => (
          <span className="chip" key={code}>
            {code} <strong>{count}</strong>
          </span>
        ))}
      </div>
      <div className="export-actions">
        <button onClick={() => onExport("project.beadproject")}>保存项目</button>
        <button className="primary-button" onClick={() => onExport("clean.png")}>
          导出图纸
        </button>
        <button onClick={() => onExport("overlay.png")}>导出检查图</button>
        <button onClick={() => onExport("mapping.csv")}>导出清单</button>
      </div>
    </section>
  );
}
