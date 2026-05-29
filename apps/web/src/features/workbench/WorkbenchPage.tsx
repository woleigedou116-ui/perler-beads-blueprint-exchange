import { useEffect, useMemo, useState } from "react";

import {
  confirmMapping,
  correctCell,
  exportUrl,
  getPalette,
  importImage,
  openProject,
  saveAttribution,
} from "../../api/client";
import { saveExport } from "../../api/exports";
import type { BeadProject, Cell, PaletteMapping } from "../../domain/types";
import { UploadPanel } from "../upload/UploadPanel";
import { ComparisonPreview } from "./ComparisonPreview";
import type { ColorStatSort } from "./colorStats";
import { PaletteReference } from "./PaletteReference";
import { ReviewPanel } from "./ReviewPanel";
import { buildReviewGroups, reviewGroupKey } from "./reviewGroups";
import { StatisticsPanel } from "./StatisticsPanel";

type ExportKind = "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject";
type ExportOptions = { includeColorStats?: boolean };
type RecognitionProgress = { label: string; value: number };

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
    const previousProject = project;
    const updated = await correctCell(
      project.id,
      cell.row,
      cell.column,
      sourceCode,
      targetCode,
    );
    applyProjectAfterDecision(previousProject, updated, cell);
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

  function handleSelectCell(cell: Cell) {
    setSelectedCell(cell);
    setFocusRequest({ cell, nonce: Date.now() });
  }

  function findUpdatedCell(updatedProject: BeadProject, cell: Cell) {
    return (
      updatedProject.cells.find(
        (next) => next.row === cell.row && next.column === cell.column,
      ) ?? null
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
              sourceImageUrl={previewUrl}
              onFullscreenChange={setIsReviewFullscreen}
              onSelectCell={handleSelectCell}
            />
            <StatisticsPanel
              paletteMappings={paletteMappings}
              project={project}
              onExport={handleExport}
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
          selectedCell={selectedCell}
          onAutoLocateAfterDecisionChange={setAutoLocateAfterDecision}
          onColorStatSortChange={setColorStatSort}
          onConfirmMapping={handleConfirmMapping}
          onCorrectCell={handleCorrectCell}
          onLocateCell={(cell) => setFocusRequest({ cell, nonce: Date.now() })}
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
