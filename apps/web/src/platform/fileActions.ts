export type ExportKind = "clean.png" | "overlay.png" | "mapping.csv" | "project.beadproject";

interface FileSystemWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>;
}

const EXPORT_TYPES: Record<ExportKind, SaveFilePickerOptions["types"]> = {
  "clean.png": [
    { description: "PNG 图片", accept: { "image/png": [".png"] } },
  ],
  "overlay.png": [
    { description: "PNG 图片", accept: { "image/png": [".png"] } },
  ],
  "mapping.csv": [
    { description: "CSV 表格", accept: { "text/csv": [".csv"] } },
  ],
  "project.beadproject": [
    {
      description: "拼豆项目",
      accept: { "application/octet-stream": [".beadproject"] },
    },
  ],
};

function supportsSavePicker(): boolean {
  return typeof (window as SavePickerWindow).showSaveFilePicker === "function";
}

function fallbackDownload(url: string, kind: ExportKind) {
  const link = document.createElement("a");
  link.href = url;
  link.download = kind;
  link.click();
}

export async function saveExport(url: string, kind: ExportKind): Promise<void> {
  if (!supportsSavePicker()) {
    fallbackDownload(url, kind);
    return;
  }

  try {
    const picker = (window as SavePickerWindow).showSaveFilePicker;
    if (!picker) {
      fallbackDownload(url, kind);
      return;
    }
    const handle = await picker({
      suggestedName: kind,
      types: EXPORT_TYPES[kind],
    });
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("导出失败，请稍后重试");
    }
    const writable = await handle.createWritable();
    await writable.write(await response.blob());
    await writable.close();
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      return;
    }
    throw caught;
  }
}
