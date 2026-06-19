import { useEffect, useState } from "react";

import type { BeadProject } from "../../domain/types";
import { Button } from "../../shared/ui";

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
  const [importSubmitted, setImportSubmitted] = useState(false);
  const importLocked = processing || importSubmitted;
  const recognitionMessage =
    recognitionElapsedMs === null
      ? RECOGNITION_MESSAGES[0]
      : RECOGNITION_MESSAGES[
          Math.floor(recognitionElapsedMs / 5000) % RECOGNITION_MESSAGES.length
        ];

  useEffect(() => {
    if (!processing) {
      setRecognitionElapsedMs(null);
      setImportSubmitted(false);
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
    <section className="panel project-sidebar" aria-label="项目与输入">
      <div className="sidebar-section-heading">
        <h2>项目</h2>
        <span>本地处理</span>
      </div>
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
      <Button
        className="primary-button"
        disabled={!file || importLocked}
        type="button"
        variant="primary"
        onClick={() => {
          if (!file || importLocked) {
            return;
          }
          setImportSubmitted(true);
          onImport();
        }}
      >
        {importLocked ? "识别中..." : "开始识别"}
      </Button>
      {processing && recognitionElapsedMs !== null ? (
        <div className="recognition-progress" aria-live="polite">
          <div className="recognition-progress-heading">
            <span>正在识别图纸</span>
            <strong>已用时 {formatDuration(recognitionElapsedMs)}</strong>
          </div>
          <div
            aria-label="识别进度"
            className="recognition-progress-bar"
            role="progressbar"
          >
            <span />
          </div>
          <p>{recognitionMessage}</p>
        </div>
      ) : null}
      {!processing && lastRecognitionDurationMs !== null ? (
        <div className="recognition-duration">
          <p>本次识别用时 {formatDuration(lastRecognitionDurationMs)}</p>
        </div>
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
          <Button
            className="quiet-button"
            type="button"
            variant="subtle"
            onClick={onSaveAttribution}
          >
            保存出处
          </Button>
        </>
      ) : null}
    </section>
  );
}

const RECOGNITION_MESSAGES = [
  "正在分析图纸网格和色号。",
  "正在生成可校对的 COCO 初稿。",
  "复杂图纸可能需要更久，请保持当前页面开启。",
];

function formatDuration(durationMs: number): string {
  return `${(Math.max(0, durationMs) / 1000).toFixed(1)} 秒`;
}
