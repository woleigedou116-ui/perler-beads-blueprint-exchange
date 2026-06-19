export type AppRoute = "workbench" | "desktop-ui-prototype";

export function getAppRoute(search: string): AppRoute {
  const searchParams = new URLSearchParams(search);
  return searchParams.get("prototype") === "desktop-ui"
    ? "desktop-ui-prototype"
    : "workbench";
}
