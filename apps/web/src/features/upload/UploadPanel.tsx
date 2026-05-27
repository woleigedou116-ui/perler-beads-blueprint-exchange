import type { BeadProject } from "../../domain/types";

interface UploadPanelProps {
  attribution: string;
  file: File | null;
  previewUrl: string | null;
  processing: boolean;
  project: BeadProject | null;
  onAttributionChange: (value: string) => void;
  onImport: () => void;
  onSaveAttribution: () => void;
  onSelectFile: (file: File | null) => void;
}

export function UploadPanel({
  attribution,
  file,
  previewUrl,
  processing,
  project,
  onAttributionChange,
  onImport,
  onSaveAttribution,
  onSelectFile,
}: UploadPanelProps) {
  return (
    <section className="panel upload-panel" aria-label="上传与参数">
      <h2>上传与参数</h2>
      <label className="file-field">
        <span>上传图纸</span>
        <input
          aria-label="上传图纸"
          accept=".jpg,.jpeg,.png,.webp"
          type="file"
          onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
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
