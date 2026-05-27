import { useEffect, useState } from "react";

import type { BeadProject, Cell } from "../../domain/types";

interface ReviewPanelProps {
  project: BeadProject;
  selectedCell: Cell | null;
  onConfirmMapping: (cell: Cell) => void;
  onCorrectCell: (cell: Cell, sourceCode: string, targetCode: string) => void;
  onSelectCell: (cell: Cell) => void;
}

export function ReviewPanel({
  project,
  selectedCell,
  onConfirmMapping,
  onCorrectCell,
  onSelectCell,
}: ReviewPanelProps) {
  const reviewCells = project.cells.filter((cell) => cell.status === "review-required");
  const [sourceCode, setSourceCode] = useState("");
  const [targetCode, setTargetCode] = useState("");

  useEffect(() => {
    setSourceCode(
      selectedCell?.confirmed_source_code ?? selectedCell?.detected_source_code ?? "",
    );
    setTargetCode(selectedCell?.target_code ?? "");
  }, [selectedCell]);

  return (
    <section className="panel review-panel" aria-label="待确认事项">
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
              {source !== "?" && target !== "?" ? (
                <button onClick={() => onConfirmMapping(cell)}>
                  确认 {source} -&gt; {target}
                </button>
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
    </section>
  );
}
