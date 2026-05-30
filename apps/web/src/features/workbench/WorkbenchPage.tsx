import { useEffect, useMemo, useState } from "react";

import {
  confirmMapping,
  correctCell,
  exportUrl,
  getPalette,
  importImage,
  markCellUnwanted,
  markRegionUnwanted,
  openProject,
  saveAttribution,
} from "../../api/client";
import { saveExport } from "../../api/exports";
import type { BeadProject, Cell, PaletteMapping } from "../../domain/types";
import { UploadPanel } from "../upload/UploadPanel";
import { ComparisonPreview } from "./ComparisonPreview";
import type { ColorStatSort } from "./colorStats";
import { ExportActions } from "./ExportActions";
import { PaletteReference } from "./PaletteReference";
import { ReviewPanel } from "./ReviewPanel";
import { buildReviewGroups, reviewGroupKey } from "./reviewGroups";
import type { CellRegionBounds } from "./GridPreview";

type ExportKind = "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject";
type ExportOptions = { includeColorStats?: boolean };
type RecognitionProgress = { label: string; value: number };
type RegionSelection = { start: Cell | null; end: Cell | null };

const RECOGNITION_STAGES: RecognitionProgress[] = [
  { label: "上传图纸中", value: 12 },
  { label: "检测网格中", value: 38 },
  { label: "OCR 与颜色匹配中", value: 68 },
  { label: "生成项目中", value: 88 },
];

const DEFAULT_COLOR_STAT_SORT: ColorStatSort = {
  sortBy: "code",
  sortDirection: "asc",
};

export function WorkbenchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [project, setProject] = useState<BeadProject | null>(null);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [attribution, setAttribution] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ cell: Cell; nonce: number } | null>(null);
  const [paletteMappings, setPaletteMappings] = useState<PaletteMapping[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recognitionProgress, setRecognitionProgress] =
    useState<RecognitionProgress | null>(null);
  const [isReviewFullscreen, setIsReviewFullscreen] = useState(false);
  const [autoLocateAfterDecision, setAutoLocateAfterDecision] = useState(true);
  const [regionSelection, setRegionSelection] = useState<RegionSelection | null>(null);
  const [colorStatSort, setColorStatSort] = useState<ColorStatSort>(
    DEFAULT_COLOR_STAT_SORT,
  );

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    getPalette()
      .then((palette) => {
        if (!cancelled) {
          setPaletteMappings(palette.mappings);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPaletteMappings([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!processing) {
      return;
    }
    let stageIndex = 0;
    setRecognitionProgress(RECOGNITION_STAGES[stageIndex]);
    const timer = window.setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, RECOGNITION_STAGES.length - 1);
      setRecognitionProgress(RECOGNITION_STAGES[stageIndex]);
    }, 800);
    return () => window.clearInterval(timer);
  }, [processing]);

  useEffect(() => {
    if (!isReviewFullscreen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsReviewFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReviewFullscreen]);

  const reviewCount = useMemo(
    () => project?.cells.filter((cell) => cell.status === "review-required").length ?? 0,
    [project],
  );
  const selectedRegionBounds = useMemo(
    () =>
      regionSelection?.start
        ? normalizeRegionBounds(
            regionSelection.start,
            regionSelection.end ?? regionSelection.start,
          )
        : null,
    [regionSelection],
  );
  const regionSelectionLabel = selectedRegionBounds
    ? `已选择 ${selectedRegionBounds.startRow + 1}, ${selectedRegionBounds.startColumn + 1} 到 ${selectedRegionBounds.endRow + 1}, ${selectedRegionBounds.endColumn + 1}`
    : null;

  async function handleImport() {
    if (!file) {
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const imported = await importImage(file);
      loadProject(imported);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "识别失败");
    } finally {
      setProcessing(false);
      setRecognitionProgress(null);
    }
  }

  function loadProject(opened: BeadProject) {
    setProject(opened);
    setAttribution(opened.source_attribution ?? "");
    setColorStatSort(DEFAULT_COLOR_STAT_SORT);
    setSelectedCell(
      opened.cells.find((cell) => cell.status === "review-required") ??
        opened.cells[0] ??
        null,
    );
    setRegionSelection(null);
  }

  async function handleOpenProject(archive: File) {
    setProcessing(true);
    setError(null);
    try {
      loadProject(await openProject(archive));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "项目打开失败");
    } finally {
      setProcessing(false);
    }
  }

  async function handleConfirmMapping(cell: Cell) {
    if (!project || !cell.detected_source_code || !cell.target_code) {
      return;
    }
    const previousProject = project;
    const updated = await confirmMapping(
      project.id,
      cell.detected_source_code,
      cell.target_code,
    );
    applyProjectAfterDecision(previousProject, updated, cell);
  }

  async function handleCorrectCell(cell: Cell, sourceCode: string, targetCode: string) {
    if (!project) {
      return;
    }
    const updated = await correctCell(
      project.id,
      cell.row,
      cell.column,
      sourceCode,
      targetCode,
    );
    applyProjectAfterCorrection(updated, cell);
  }

  async function handleMarkCellUnwanted(cell: Cell) {
    if (!project || cell.status === "empty") {
      return;
    }
    const previousProject = project;
    const updated = await markCellUnwanted(project.id, cell.row, cell.column);
    applyProjectAfterUnwanted(previousProject, updated, cell);
  }

  async function handleApplyRegionUnwanted() {
    if (!project || !regionSelection?.start || !regionSelection.end) {
      return;
    }
    const bounds = normalizeRegionBounds(regionSelection.start, regionSelection.end);
    const updated = await markRegionUnwanted(
      project.id,
      bounds.startRow,
      bounds.startColumn,
      bounds.endRow,
      bounds.endColumn,
    );
    applyProjectAfterRegionUnwanted(updated, bounds);
    setRegionSelection(null);
  }

  function applyProjectAfterDecision(
    previousProject: BeadProject,
    updatedProject: BeadProject,
    decidedCell: Cell,
  ) {
    const next = cellAfterDecision(previousProject, updatedProject, decidedCell);
    setProject(updatedProject);
    setSelectedCell(next.cell);
    if (next.shouldLocate && next.cell) {
      setFocusRequest({ cell: next.cell, nonce: Date.now() });
    }
  }

  function applyProjectAfterCorrection(updatedProject: BeadProject, correctedCell: Cell) {
    const updatedSameCell = findUpdatedCell(updatedProject, correctedCell);
    setProject(updatedProject);
    setSelectedCell(updatedSameCell);
    if (updatedSameCell) {
      setFocusRequest({ cell: updatedSameCell, nonce: Date.now() });
    }
  }

  function applyProjectAfterUnwanted(
    previousProject: BeadProject,
    updatedProject: BeadProject,
    unwantedCell: Cell,
  ) {
    const next = cellAfterDecision(previousProject, updatedProject, unwantedCell);
    const fallbackCell = next.cell?.status === "empty"
      ? nonEmptyFallbackCell(updatedProject, unwantedCell)
      : next.cell;
    setProject(updatedProject);
    setSelectedCell(fallbackCell);
    if (next.shouldLocate && fallbackCell) {
      setFocusRequest({ cell: fallbackCell, nonce: Date.now() });
    }
  }

  function applyProjectAfterRegionUnwanted(
    updatedProject: BeadProject,
    bounds: CellRegionBounds,
  ) {
    const updatedSameCell = selectedCell ? findUpdatedCell(updatedProject, selectedCell) : null;
    const fallbackCell =
      updatedSameCell?.status && updatedSameCell.status !== "empty"
        ? updatedSameCell
        : firstNonEmptyCellOutsideRegion(updatedProject, bounds);
    setProject(updatedProject);
    setSelectedCell(fallbackCell);
    if (fallbackCell) {
      setFocusRequest({ cell: fallbackCell, nonce: Date.now() });
    }
  }

  function handleSelectCell(cell: Cell) {
    if (regionSelection !== null) {
      setRegionSelection((current) => {
        if (!current) {
          return current;
        }
        if (!current.start || current.end) {
          return { start: cell, end: null };
        }
        return { start: current.start, end: cell };
      });
    }
    setSelectedCell(cell);
    setFocusRequest({ cell, nonce: Date.now() });
  }

  function handleStartRegionUnwanted() {
    setRegionSelection({ start: null, end: null });
  }

  function handleCancelRegionUnwanted() {
    setRegionSelection(null);
  }

  function findUpdatedCell(updatedProject: BeadProject, cell: Cell) {
    return (
      updatedProject.cells.find(
        (next) => next.row === cell.row && next.column === cell.column,
      ) ?? null
    );
  }

  function nonEmptyFallbackCell(updatedProject: BeadProject, cell: Cell) {
    const sortedCells = [...updatedProject.cells].sort(
      (left, right) => left.row - right.row || left.column - right.column,
    );
    const currentIndex = sortedCells.findIndex(
      (next) => next.row === cell.row && next.column === cell.column,
    );
    return (
      sortedCells
        .slice(Math.max(currentIndex, 0) + 1)
        .find((next) => next.status !== "empty") ??
      sortedCells
        .slice(0, Math.max(currentIndex, 0))
        .reverse()
        .find((next) => next.status !== "empty") ??
      null
    );
  }

  function firstNonEmptyCellOutsideRegion(
    updatedProject: BeadProject,
    bounds: CellRegionBounds,
  ) {
    return (
      [...updatedProject.cells]
        .sort((left, right) => left.row - right.row || left.column - right.column)
        .find((cell) => cell.status !== "empty" && !cellInRegion(cell, bounds)) ?? null
    );
  }

  function cellAfterDecision(
    previousProject: BeadProject,
    updatedProject: BeadProject,
    decidedCell: Cell,
  ): { cell: Cell | null; shouldLocate: boolean } {
    const updatedSameCell = findUpdatedCell(updatedProject, decidedCell);
    if (!autoLocateAfterDecision) {
      return { cell: updatedSameCell, shouldLocate: false };
    }

    const previousGroups = buildReviewGroups(
      previousProject.cells.filter((cell) => cell.status === "review-required"),
    );
    const updatedGroups = buildReviewGroups(
      updatedProject.cells.filter((cell) => cell.status === "review-required"),
    );
    const decidedGroupIndex = previousGroups.findIndex(
      (group) => group.key === reviewGroupKey(decidedCell),
    );

    if (updatedGroups.length > 0) {
      const fallbackIndex = decidedGroupIndex >= 0 ? decidedGroupIndex : 0;
      const nextGroup = updatedGroups[Math.min(fallbackIndex, updatedGroups.length - 1)];
      return { cell: nextGroup.cells[0], shouldLocate: true };
    }

    return { cell: updatedSameCell, shouldLocate: false };
  }

  async function handleSaveAttribution() {
    if (project) {
      setProject(await saveAttribution(project.id, attribution));
    }
  }

  async function handleExport(kind: ExportKind, options: ExportOptions = {}) {
    if (!project) {
      return;
    }
    if (
      reviewCount > 0 &&
      !window.confirm(
        `当前仍有 ${reviewCount} 个待确认格子，导出结果可能使用推荐颜色。仍要导出吗？`,
      )
    ) {
      return;
    }
    try {
      await saveExport(exportUrl(project.id, kind, options), kind);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "导出失败，请稍后重试");
    }
  }

  return (
    <div
      aria-label="拼豆转换工作台"
      className={`workbench${isReviewFullscreen ? " review-fullscreen" : ""}`}
    >
      <UploadPanel
        attribution={attribution}
        file={file}
        previewUrl={previewUrl}
        processing={processing}
        project={project}
        recognitionProgress={recognitionProgress}
        onAttributionChange={setAttribution}
        onImport={handleImport}
        onOpenProject={handleOpenProject}
        onSaveAttribution={handleSaveAttribution}
        onSelectFile={setFile}
      />
      <section className="center-workspace" aria-label="图纸对照预览">
        {error ? <p className="error-note">{error}</p> : null}
        {project ? (
          <>
            <ComparisonPreview
              colorStatSort={colorStatSort}
              focusRequest={focusRequest}
              fullscreen={isReviewFullscreen}
              paletteMappings={paletteMappings}
              project={project}
              selectedRegionBounds={selectedRegionBounds}
              sourceImageUrl={previewUrl}
              toolbarActions={<ExportActions onExport={handleExport} />}
              onFullscreenChange={setIsReviewFullscreen}
              onSelectCell={handleSelectCell}
            />
            <PaletteReference paletteMappings={paletteMappings} project={project} />
          </>
        ) : (
          <div className="empty-workspace">
            <h2>等待图纸</h2>
            <p>上传带 MARD 色号的规则网格图片后，此处会生成 COCO 初稿。</p>
          </div>
        )}
      </section>
      {project ? (
        <ReviewPanel
          autoLocateAfterDecision={autoLocateAfterDecision}
          colorStatSort={colorStatSort}
          paletteMappings={paletteMappings}
          project={project}
          regionSelectionActive={regionSelection !== null}
          regionSelectionComplete={Boolean(regionSelection?.start && regionSelection.end)}
          regionSelectionLabel={regionSelectionLabel}
          selectedCell={selectedCell}
          onAutoLocateAfterDecisionChange={setAutoLocateAfterDecision}
          onApplyRegionUnwanted={handleApplyRegionUnwanted}
          onCancelRegionUnwanted={handleCancelRegionUnwanted}
          onColorStatSortChange={setColorStatSort}
          onConfirmMapping={handleConfirmMapping}
          onCorrectCell={handleCorrectCell}
          onLocateCell={(cell) => setFocusRequest({ cell, nonce: Date.now() })}
          onMarkCellUnwanted={handleMarkCellUnwanted}
          onStartRegionUnwanted={handleStartRegionUnwanted}
          onSelectCell={handleSelectCell}
        />
      ) : (
        <aside className="panel review-panel idle-review">
          <h2>校对</h2>
          <p>识别后，疑点会集中列在这里。</p>
        </aside>
      )}
    </div>
  );
}

function normalizeRegionBounds(start: Cell, end: Cell): CellRegionBounds {
  return {
    startRow: Math.min(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endRow: Math.max(start.row, end.row),
    endColumn: Math.max(start.column, end.column),
  };
}

function cellInRegion(cell: Cell, bounds: CellRegionBounds) {
  return (
    cell.row >= bounds.startRow &&
    cell.row <= bounds.endRow &&
    cell.column >= bounds.startColumn &&
    cell.column <= bounds.endColumn
  );
}
