interface WorkbenchCommandBarProps {
  projectLoaded: boolean;
  reviewCount: number;
  onExportClean: () => void;
  onExportMapping: () => void;
  onExportOverlay: () => void;
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
  return (
    <header className="workbench-command-bar" role="banner">
      <div className="command-brand">
        <strong>拼豆图纸转换工具</strong>
        <span>MARD -&gt; COCO</span>
      </div>
      <nav aria-label="项目命令" className="command-group">
        <label
          aria-label="导入图片"
          className="command-file-button"
          role="button"
          tabIndex={0}
        >
          导入图片
          <input
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
        </label>
        <label
          aria-label="打开项目"
          className="command-file-button"
          role="button"
          tabIndex={0}
        >
          打开项目
          <input
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
        </label>
        <button disabled={!projectLoaded} type="button" onClick={onSaveProject}>
          保存项目
        </button>
      </nav>
      <nav aria-label="导出命令" className="command-group">
        <span className="command-review-count">待确认 {reviewCount}</span>
        <button disabled={!projectLoaded} type="button" onClick={onExportClean}>
          导出图纸
        </button>
        <button disabled={!projectLoaded} type="button" onClick={onExportOverlay}>
          导出检查图
        </button>
        <button disabled={!projectLoaded} type="button" onClick={onExportMapping}>
          导出清单
        </button>
      </nav>
    </header>
  );
}
