import { useRef, useState } from "react";

type ImageExportOptions = { includeColorStats: boolean };

interface WorkbenchCommandBarProps {
  projectLoaded: boolean;
  reviewCount: number;
  onExportClean: (options: ImageExportOptions) => void;
  onExportMapping: () => void;
  onExportOverlay: (options: ImageExportOptions) => void;
  onOpenProject: (file: File) => void;
  onSaveProject: () => void;
  onSelectImage: (file: File) => void;
}

export function WorkbenchCommandBar({
  projectLoaded,
  reviewCount,
  onExportClean,
  onExportMapping,
  onExportOverlay,
  onOpenProject,
  onSaveProject,
  onSelectImage,
}: WorkbenchCommandBarProps) {
  const [includeColorStats, setIncludeColorStats] = useState(true);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const projectInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <header className="workbench-command-bar" role="banner">
      <div className="command-brand">
        <strong>拼豆图纸转换工具</strong>
        <span>MARD -&gt; COCO</span>
      </div>
      <nav aria-label="项目命令" className="command-group">
        <button
          className="command-file-button"
          type="button"
          onClick={() => imageInputRef.current?.click()}
        >
          导入图片
        </button>
        <input
          ref={imageInputRef}
          aria-label="从命令栏导入图片"
          accept=".jpg,.jpeg,.png,.webp"
          hidden
          type="file"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              onSelectImage(selected);
            }
          }}
        />
        <button
          className="command-file-button"
          type="button"
          onClick={() => projectInputRef.current?.click()}
        >
          打开项目
        </button>
        <input
          ref={projectInputRef}
          aria-label="从命令栏打开项目"
          accept=".beadproject"
          hidden
          type="file"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            if (selected) {
              onOpenProject(selected);
            }
          }}
        />
        <button disabled={!projectLoaded} type="button" onClick={onSaveProject}>
          保存项目
        </button>
      </nav>
      <nav aria-label="导出命令" className="command-group">
        <span className="command-review-count">待确认 {reviewCount}</span>
        <label className="command-export-option">
          <input
            aria-label="导出时附带色块统计"
            checked={includeColorStats}
            type="checkbox"
            onChange={(event) => setIncludeColorStats(event.currentTarget.checked)}
          />
          导出带色块统计
        </label>
        <button
          disabled={!projectLoaded}
          type="button"
          onClick={() => onExportClean({ includeColorStats })}
        >
          导出图纸
        </button>
        <button
          disabled={!projectLoaded}
          type="button"
          onClick={() => onExportOverlay({ includeColorStats })}
        >
          导出检查图
        </button>
        <button disabled={!projectLoaded} type="button" onClick={onExportMapping}>
          导出清单
        </button>
      </nav>
    </header>
  );
}
