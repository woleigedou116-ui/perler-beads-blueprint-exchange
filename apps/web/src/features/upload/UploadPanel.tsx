import { useEffect, useState } from "react";

import type { BeadProject } from "../../domain/types";

interface UploadPanelProps {
  attribution: string;
  file: File | null;
  lastRecognitionDurationMs?: number | null;
  previewUrl: string | null;
  processing: boolean;
  project: BeadProject | null;
  onAttributionChange: (value: string) => void;
  onImport: () => void;
  onOpenProject: (file: File) => void;
  onSaveAttribution: () => void;
  onSelectFile: (file: File | null) => void;
}

export function UploadPanel({
  attribution,
  file,
  lastRecognitionDurationMs = null,
  previewUrl,
  processing,
  project,
  onAttributionChange,
  onImport,
  onOpenProject,
  onSaveAttribution,
  onSelectFile,
}: UploadPanelProps) {
  const [recognitionElapsedMs, setRecognitionElapsedMs] = useState<number | null>(null);

  useEffect(() => {
    if (!processing) {
      setRecognitionElapsedMs(null);
      return;
    }

    const startedAt = Date.now();
    setRecognitionElapsedMs(0);
    const timer = window.setInterval(() => {
      setRecognitionElapsedMs(Date.now() - startedAt);
    }, 100);

    return () => window.clearInterval(timer);
  }, [processing]);

  return (
    <section className="panel upload-panel" aria-label="上传与参数">
      <h2>上传与参数</h2>
      <label className="file-field">
        <span>上传图纸</span>
        <input
          aria-label="上传图纸"
          accept=".jpg,.jpeg,.png,.webp"
          type="file"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              onSelectFile(selected);
            }
          }}
        />
      </label>
      {previewUrl ? (
        <img className="upload-preview" src={previewUrl} alt="上传图纸预览" />
      ) : (
        <div className="upload-placeholder">选择规则网格图纸开始识别</div>
      )}
      <div className="standards">
        <label>
          来源标准
          <select value="MARD" disabled>
            <option>MARD</option>
          </select>
        </label>
        <label>
          目标标准
          <select value="COCO" disabled>
            <option>COCO</option>
          </select>
        </label>
      </div>
      <button className="primary-button" disabled={!file || processing} onClick={onImport}>
        {processing ? "识别中..." : "开始识别"}
      </button>
      {processing && recognitionElapsedMs !== null ? (
        <div className="recognition-progress" aria-live="polite">
          <div className="recognition-progress-heading">
            <span>正在识别图纸</span>
            <strong>已用时 {formatDuration(recognitionElapsedMs)}</strong>
          </div>
          <p>水印、低清或文字较多的图纸会更久，请稍等。</p>
        </div>
      ) : null}
      {!processing && lastRecognitionDurationMs !== null ? (
        <p className="recognition-duration">
          本次识别用时 {formatDuration(lastRecognitionDurationMs)}
        </p>
      ) : null}
      <label className="project-file-field">
        <span>打开项目</span>
        <input
          aria-label="打开项目"
          accept=".beadproject"
          type="file"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              onOpenProject(selected);
            }
          }}
        />
      </label>
      {project ? (
        <>
          <p className="grid-status">网格 {project.grid.rows} x {project.grid.columns}</p>
          <label className="attribution-field">
            原图出处
            <textarea
              value={attribution}
              onChange={(event) => onAttributionChange(event.target.value)}
              placeholder="记录作者或来源链接"
            />
          </label>
          <button className="quiet-button" onClick={onSaveAttribution}>
            保存出处
          </button>
        </>
      ) : null}
    </section>
  );
}

function formatDuration(durationMs: number): string {
  return `${(Math.max(0, durationMs) / 1000).toFixed(1)} 秒`;
}
