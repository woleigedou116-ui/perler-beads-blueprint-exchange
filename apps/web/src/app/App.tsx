import { WorkbenchPrototypePage } from "../pages/workbench/WorkbenchPrototypePage";
import { AppProviders } from "./providers/AppProviders";
import { getAppRoute } from "./routes/getAppRoute";
import { WorkbenchPage } from "../features/workbench/WorkbenchPage";

export function App() {
  const route = getAppRoute(window.location.search);
  return (
    <AppProviders>
      {route === "desktop-ui-prototype" ? (
        <WorkbenchPrototypePage />
      ) : (
        <main className="app-shell">
          <WorkbenchPage />
        </main>
      )}
    </AppProviders>
  );
}
