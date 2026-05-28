import { useEffect, useState } from "react";

import type { BeadProject, Cell, PaletteMapping, RGB } from "../../domain/types";

interface ReviewPanelProps {
  paletteMappings?: PaletteMapping[];
  project: BeadProject;
  selectedCell: Cell | null;
  onConfirmMapping: (cell: Cell) => void;
  onCorrectCell: (cell: Cell, sourceCode: string, targetCode: string) => void;
  onLocateCell?: (cell: Cell) => void;
  onSelectCell: (cell: Cell) => void;
}

export function ReviewPanel({
  paletteMappings = [],
  project,
  selectedCell,
  onConfirmMapping,
  onCorrectCell,
  onLocateCell,
  onSelectCell,
}: ReviewPanelProps) {
  const reviewCells = project.cells.filter((cell) => cell.status === "review-required");
  const [sourceCode, setSourceCode] = useState("");
  const [targetCode, setTargetCode] = useState("");
  const [candidateCellKey, setCandidateCellKey] = useState<string | null>(null);

  useEffect(() => {
    setSourceCode(
      selectedCell?.confirmed_source_code ?? selectedCell?.detected_source_code ?? "",
    );
    setTargetCode(selectedCell?.target_code ?? "");
  }, [selectedCell]);

  function cellKey(cell: Cell) {
    return `${cell.row}-${cell.column}`;
  }

  function colorDistance(first: RGB, second: RGB) {
    return Math.sqrt(
      (first.r - second.r) ** 2 +
        (first.g - second.g) ** 2 +
        (first.b - second.b) ** 2,
    );
  }

  function nearestCandidates(cell: Cell) {
    if (!cell.sampled_color) {
      return [];
    }
    return paletteMappings
      .filter((mapping) => mapping.target_code && mapping.target_rgb)
      .map((mapping) => ({
        ...mapping,
        distance: colorDistance(cell.sampled_color as RGB, mapping.target_rgb as RGB),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 5);
  }

  function sourceFor(cell: Cell) {
    return cell.confirmed_source_code ?? cell.detected_source_code ?? "";
  }

  return (
    <aside className="panel review-panel" aria-label="待确认事项">
      <div className="panel-heading">
        <h2>校对</h2>
        <strong>待确认 {reviewCells.length} 项</strong>
      </div>
      <div className="review-list">
        {reviewCells.map((cell) => {
          const source = cell.confirmed_source_code ?? cell.detected_source_code ?? "?";
          const target = cell.target_code ?? "?";
          return (
            <article key={`${cell.row}-${cell.column}`} onClick={() => onSelectCell(cell)}>
              <p>MARD {source}</p>
              <p>COCO {target}</p>
              <small>{cell.issue_reasons.join(", ")}</small>
              <div className="review-actions">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCell(cell);
                    onLocateCell?.(cell);
                  }}
                >
                  定位
                </button>
                {source !== "?" && target !== "?" ? (
                  <button type="button" onClick={() => onConfirmMapping(cell)}>
                    确认
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    onSelectCell(cell);
                    setCandidateCellKey((current) =>
                      current === cellKey(cell) ? null : cellKey(cell),
                    );
                  }}
                >
                  修改
                </button>
              </div>
              {candidateCellKey === cellKey(cell) ? (
                <div className="candidate-list" aria-label="近似色号候选">
                  <p>近似色号</p>
                  {nearestCandidates(cell).map((candidate) => (
                    <button
                      key={`${candidate.source_code}-${candidate.target_code}`}
                      type="button"
                      onClick={() => {
                        if (candidate.target_code) {
                          onCorrectCell(cell, sourceFor(cell), candidate.target_code);
                        }
                      }}
                    >
                      改为 {candidate.target_code}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
        {reviewCells.length === 0 ? <p className="complete-note">全部疑点已确认</p> : null}
      </div>
      {selectedCell ? (
        <form
          className="cell-editor"
          onSubmit={(event) => {
            event.preventDefault();
            onCorrectCell(selectedCell, sourceCode, targetCode);
          }}
        >
          <h3>选中格 {selectedCell.row + 1}, {selectedCell.column + 1}</h3>
          <label>
            来源色号
            <input value={sourceCode} onChange={(event) => setSourceCode(event.target.value)} />
          </label>
          <label>
            目标色号
            <input value={targetCode} onChange={(event) => setTargetCode(event.target.value)} />
          </label>
          <button disabled={!sourceCode || !targetCode} type="submit">
            修正选中格
          </button>
        </form>
      ) : null}
    </aside>
  );
}
