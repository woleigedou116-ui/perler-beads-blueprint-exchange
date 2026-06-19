import { useState } from "react";

import { Button } from "../../shared/ui";

type ExportKind = "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject";

interface ExportActionsProps {
  onExport: (kind: ExportKind, options?: { includeColorStats?: boolean }) => void;
}

export function ExportActions({ onExport }: ExportActionsProps) {
  const [includeColorStats, setIncludeColorStats] = useState(true);

  return (
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
      <Button size="sm" type="button" onClick={() => onExport("project.beadproject")}>
        保存项目
      </Button>
      <Button
        className="primary-button"
        size="sm"
        type="button"
        variant="primary"
        onClick={() => onExport("clean.png", { includeColorStats })}
      >
        导出图纸
      </Button>
      <Button
        size="sm"
        type="button"
        onClick={() => onExport("overlay.png", { includeColorStats })}
      >
        导出检查图
      </Button>
      <Button size="sm" type="button" onClick={() => onExport("mapping.csv")}>
        导出清单
      </Button>
    </div>
  );
}
