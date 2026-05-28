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
import type { BeadProject, Cell, PaletteMapping } from "../../domain/types";
import { UploadPanel } from "../upload/UploadPanel";
import { ComparisonPreview } from "./ComparisonPreview";
import { PaletteReference } from "./PaletteReference";
import { ReviewPanel } from "./ReviewPanel";
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
    const updated = await confirmMapping(
      project.id,
      cell.detected_source_code,
      cell.target_code,
    );
    setProject(updated);
    setSelectedCell(updated.cells.find((next) => next.status === "review-required") ?? null);
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
    setProject(updated);
    setSelectedCell(
      updated.cells.find(
        (next) => next.row === cell.row && next.column === cell.column,
      ) ?? null,
    );
  }

  async function handleSaveAttribution() {
    if (project) {
      setProject(await saveAttribution(project.id, attribution));
    }
  }

  function handleExport(kind: ExportKind, options: ExportOptions = {}) {
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
    const link = document.createElement("a");
    link.href = exportUrl(project.id, kind, options);
    link.download = kind;
    link.click();
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
              focusRequest={focusRequest}
              fullscreen={isReviewFullscreen}
              paletteMappings={paletteMappings}
              project={project}
              sourceImageUrl={previewUrl}
              onFullscreenChange={setIsReviewFullscreen}
              onSelectCell={setSelectedCell}
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
          paletteMappings={paletteMappings}
          project={project}
          selectedCell={selectedCell}
          onConfirmMapping={handleConfirmMapping}
          onCorrectCell={handleCorrectCell}
          onLocateCell={(cell) => setFocusRequest({ cell, nonce: Date.now() })}
          onSelectCell={setSelectedCell}
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
