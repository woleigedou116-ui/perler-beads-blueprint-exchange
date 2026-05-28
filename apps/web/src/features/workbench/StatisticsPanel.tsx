import { useState } from "react";

import type { BeadProject, PaletteMapping } from "../../domain/types";
import { buildTargetColorStats } from "./colorStats";

interface StatisticsPanelProps {
  paletteMappings?: PaletteMapping[];
  project: BeadProject;
  onExport: (
    kind: "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject",
    options?: { includeColorStats?: boolean },
  ) => void;
}

export function StatisticsPanel({
  paletteMappings = [],
  project,
  onExport,
}: StatisticsPanelProps) {
  const [includeColorStats, setIncludeColorStats] = useState(true);
  const colorStats = buildTargetColorStats(project, paletteMappings);

  return (
    <section className="stats-panel" aria-label="统计与导出">
      <div className="chips">
        {colorStats.map((stat) => (
          <span className="chip" key={stat.code}>
            {stat.code} <strong>{stat.count}</strong>
          </span>
        ))}
      </div>
      <div className="export-actions">
        <label className="export-option">
          <input
            aria-label="导出时附带色块统计"
            checked={includeColorStats}
            type="checkbox"
            onChange={(event) => setIncludeColorStats(event.currentTarget.checked)}
          />
          导出带色块统计
        </label>
        <button onClick={() => onExport("project.beadproject")}>保存项目</button>
        <button
          className="primary-button"
          onClick={() =>
            onExport("clean.png", { includeColorStats })
          }
        >
          导出图纸
        </button>
        <button
          onClick={() =>
            onExport("overlay.png", { includeColorStats })
          }
        >
          导出检查图
        </button>
        <button onClick={() => onExport("mapping.csv")}>导出清单</button>
      </div>
    </section>
  );
}
