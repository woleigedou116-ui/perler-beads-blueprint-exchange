import { WorkbenchPage } from "../features/workbench/WorkbenchPage";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MARD -&gt; COCO</p>
          <h1>拼豆图纸标准转换</h1>
        </div>
        <p className="local-note">图片与项目文件仅在本机处理</p>
      </header>
      <WorkbenchPage />
    </main>
  );
}
