import { useEffect, useMemo, useState } from "react";

import {
  confirmMapping,
  correctCell,
  exportUrl,
  importImage,
  saveAttribution,
} from "../../api/client";
import type { BeadProject, Cell } from "../../domain/types";
import { UploadPanel } from "../upload/UploadPanel";
import { GridPreview } from "./GridPreview";
import { ReviewPanel } from "./ReviewPanel";
import { StatisticsPanel } from "./StatisticsPanel";

type ExportKind = "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject";

export function WorkbenchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [project, setProject] = useState<BeadProject | null>(null);
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [attribution, setAttribution] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

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
      setProject(imported);
      setAttribution(imported.source_attribution ?? "");
      setSelectedCell(
        imported.cells.find((cell) => cell.status === "review-required") ??
          imported.cells[0] ??
          null,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "识别失败");
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

  function handleExport(kind: ExportKind) {
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
    link.href = exportUrl(project.id, kind);
    link.download = kind;
    link.click();
  }

  return (
    <div className="workbench">
      <UploadPanel
        attribution={attribution}
        file={file}
        previewUrl={previewUrl}
        processing={processing}
        project={project}
        onAttributionChange={setAttribution}
        onImport={handleImport}
        onSaveAttribution={handleSaveAttribution}
        onSelectFile={setFile}
      />
      <section className="center-workspace" aria-label="图纸对照预览">
        {error ? <p className="error-note">{error}</p> : null}
        {project ? (
          <>
            <div className="preview-row">
              <GridPreview
                project={project}
                target={false}
                title="识别叠加视图"
                onSelectCell={setSelectedCell}
              />
              <GridPreview
                project={project}
                target
                title="COCO 重绘预览"
                onSelectCell={setSelectedCell}
              />
            </div>
            <StatisticsPanel project={project} onExport={handleExport} />
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
          project={project}
          selectedCell={selectedCell}
          onConfirmMapping={handleConfirmMapping}
          onCorrectCell={handleCorrectCell}
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
