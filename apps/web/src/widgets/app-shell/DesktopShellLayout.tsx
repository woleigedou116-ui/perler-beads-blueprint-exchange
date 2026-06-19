import type { ReactNode } from "react";

import { cn } from "../../shared/lib/cn";

export type DesktopShellLayoutProps = {
  body: ReactNode;
  className?: string;
  statusBar?: ReactNode;
  topBar?: ReactNode;
};

export function DesktopShellLayout({
  body,
  className,
  statusBar,
  topBar,
}: DesktopShellLayoutProps) {
  return (
    <main className={cn("desktop-shell-layout", className)}>
      {topBar ? <header className="desktop-shell-topbar">{topBar}</header> : null}
      <section className="desktop-shell-body">{body}</section>
      {statusBar ? <footer className="desktop-shell-statusbar">{statusBar}</footer> : null}
    </main>
  );
}
