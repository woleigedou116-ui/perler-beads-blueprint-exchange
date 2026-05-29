import { useEffect, useMemo, useState } from "react";

import type { BeadProject, Cell, PaletteMapping, RGB } from "../../domain/types";
import { buildReviewGroups, compareCodes } from "./reviewGroups";

interface ReviewPanelProps {
  autoLocateAfterDecision: boolean;
  paletteMappings?: PaletteMapping[];
  project: BeadProject;
  selectedCell: Cell | null;
  onAutoLocateAfterDecisionChange: (enabled: boolean) => void;
  onConfirmMapping: (cell: Cell) => void;
  onCorrectCell: (cell: Cell, sourceCode: string, targetCode: string) => void;
  onLocateCell?: (cell: Cell) => void;
  onSelectCell: (cell: Cell) => void;
}

export function ReviewPanel({
  autoLocateAfterDecision,
  paletteMappings = [],
  project,
  selectedCell,
  onAutoLocateAfterDecisionChange,
  onConfirmMapping,
  onCorrectCell,
  onLocateCell,
  onSelectCell,
}: ReviewPanelProps) {
  const reviewCells = project.cells.filter((cell) => cell.status === "review-required");
  const reviewGroups = buildReviewGroups(reviewCells);
  const [sourceCode, setSourceCode] = useState("");
  const [targetCode, setTargetCode] = useState("");
  const [candidateGroupKey, setCandidateGroupKey] = useState<string | null>(null);
  const [expandedPaletteGroupKey, setExpandedPaletteGroupKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const sortedSourceMappings = useMemo(
    () =>
      [...paletteMappings]
        .filter((mapping) => mapping.target_code)
        .sort((left, right) =>
          compareCodes(left.source_code, right.source_code),
        ),
    [paletteMappings],
  );

  useEffect(() => {
    setSourceCode(
      selectedCell?.confirmed_source_code ?? selectedCell?.detected_source_code ?? "",
    );
    setTargetCode(selectedCell?.target_code ?? "");
  }, [selectedCell]);

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
      .filter((mapping) => mapping.target_code && mapping.source_rgb)
      .map((mapping) => ({
        ...mapping,
        distance: colorDistance(cell.sampled_color as RGB, mapping.source_rgb as RGB),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 5);
  }

  function handleCandidateClick(cell: Cell, candidate: PaletteMapping) {
    if (candidate.target_code) {
      onCorrectCell(cell, candidate.source_code, candidate.target_code);
    }
  }

  function handleSelect(cell: Cell) {
    onSelectCell(cell);
  }

  function handleLocate(cell: Cell) {
    handleSelect(cell);
    onLocateCell?.(cell);
  }

  return (
    <aside className="panel review-panel" aria-label="待确认事项">
      <div className="panel-heading">
        <h2>校对</h2>
        <div className="review-heading-actions">
          <strong>待确认 {reviewCells.length} 格 / {reviewGroups.length} 组</strong>
          <div className="review-settings-anchor">
            <button
              type="button"
              aria-expanded={showSettings}
              aria-label="校对设置"
              onClick={() => setShowSettings((current) => !current)}
            >
              设置
            </button>
            {showSettings ? (
              <div
                aria-label="校对设置"
                className="review-settings-popover"
                role="dialog"
              >
                <label className="review-setting-toggle">
                  <input
                    aria-label="处理后自动定位下一组或上一组"
                    checked={autoLocateAfterDecision}
                    type="checkbox"
                    onChange={(event) =>
                      onAutoLocateAfterDecisionChange(event.currentTarget.checked)
                    }
                  />
                  处理后自动定位下一组/上一组
                </label>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="review-list">
        {reviewGroups.map((group) => {
          const representative = group.cells[0];
          return (
            <article
              aria-label={`MARD ${group.source} 到 COCO ${group.target}，涉及 ${group.cells.length} 格`}
              key={group.key}
              onClick={() => handleSelect(representative)}
            >
              <div className="review-card-heading">
                <div>
                  <p>MARD {group.source}</p>
                  <p>COCO {group.target}</p>
                </div>
                <span>涉及 {group.cells.length} 格</span>
              </div>
              <small>{group.issueReasons.map(issueReasonLabel).join("、")}</small>
              <div className="review-actions">
                <button
                  type="button"
                  onClick={() => {
                    handleLocate(representative);
                  }}
                >
                  定位
                </button>
                {group.source !== "?" && group.target !== "?" ? (
                  <button type="button" onClick={() => onConfirmMapping(representative)}>
                    确认
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    handleSelect(representative);
                    setCandidateGroupKey((current) =>
                      current === group.key ? null : group.key,
                    );
                    setExpandedPaletteGroupKey(null);
                  }}
                >
                  修改
                </button>
              </div>
              {candidateGroupKey === group.key ? (
                <div className="candidate-list" aria-label="近似色号候选">
                  <p>来源近似色号</p>
                  {nearestCandidates(representative).map((candidate) => (
                    <button
                      key={`${candidate.source_code}-${candidate.target_code}`}
                      type="button"
                      title={`MARD ${candidate.source_code} -> COCO ${candidate.target_code}`}
                      onClick={() => handleCandidateClick(representative, candidate)}
                    >
                      {candidate.source_code}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedPaletteGroupKey((current) =>
                        current === group.key ? null : group.key,
                      )
                    }
                  >
                    更多
                  </button>
                  {expandedPaletteGroupKey === group.key ? (
                    <div className="full-candidate-list" aria-label="全部来源色号候选">
                      {sortedSourceMappings.map((mapping) => (
                        <button
                          key={`${mapping.source_code}-${mapping.target_code}`}
                          type="button"
                          title={`MARD ${mapping.source_code} -> COCO ${mapping.target_code}`}
                          onClick={() => handleCandidateClick(representative, mapping)}
                        >
                          {mapping.source_code}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
        {reviewGroups.length === 0 ? <p className="complete-note">全部疑点已确认</p> : null}
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

const ISSUE_REASON_LABELS: Record<string, string> = {
  "mapping-missing": "缺少对应色号",
  "mapping-unverified": "对照表未核验",
  "ocr-color-conflict": "OCR 色号与取色不一致",
  "color-only-suggestion": "仅根据取色推荐",
  "unreadable-cell": "未识别到有效色号",
  "ocr-fuzzy-color-suggestion": "OCR 近似识别并结合取色推荐",
  "user-confirmed-mapping": "人工确认",
  "user-corrected": "人工修正",
};

function issueReasonLabel(reason: string) {
  return ISSUE_REASON_LABELS[reason] ?? reason;
}
