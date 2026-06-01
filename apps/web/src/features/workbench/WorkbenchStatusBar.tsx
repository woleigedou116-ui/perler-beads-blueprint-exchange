import type { BeadProject, Cell } from "../../domain/types";

interface WorkbenchStatusBarProps {
  lastRecognitionDurationMs: number | null;
  project: BeadProject | null;
  reviewCount: number;
  selectedCell: Cell | null;
}

export function WorkbenchStatusBar({
  lastRecognitionDurationMs,
  project,
  reviewCount,
  selectedCell,
}: WorkbenchStatusBarProps) {
  return (
    <footer className="workbench-status-bar" role="contentinfo">
      <span>{project ? "项目已加载" : "未加载项目"}</span>
      <span>
        {project ? `网格 ${project.grid.rows} x ${project.grid.columns}` : "等待导入"}
      </span>
      <span>待确认 {reviewCount}</span>
      <span>
        {selectedCell
          ? `选中 ${selectedCell.row + 1}, ${selectedCell.column + 1}`
          : "未选中格子"}
      </span>
      <span>
        {lastRecognitionDurationMs !== null
          ? `识别 ${(lastRecognitionDurationMs / 1000).toFixed(1)} 秒`
          : "暂无识别耗时"}
      </span>
    </footer>
  );
}
