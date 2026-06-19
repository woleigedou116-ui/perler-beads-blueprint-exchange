import type { ReactNode } from "react";

import { cn } from "../../shared/lib/cn";

export type DesktopShellLayoutProps = {
  ariaLabel?: string;
  body: ReactNode;
  className?: string;
  statusBar?: ReactNode;
  topBar?: ReactNode;
};

export function DesktopShellLayout({
  ariaLabel,
  body,
  className,
  statusBar,
  topBar,
}: DesktopShellLayoutProps) {
  return (
    <main aria-label={ariaLabel} className={cn("desktop-shell-layout", className)}>
      {topBar ? <header className="desktop-shell-topbar">{topBar}</header> : null}
      <section className="desktop-shell-body">{body}</section>
      {statusBar ? <footer className="desktop-shell-statusbar">{statusBar}</footer> : null}
    </main>
  );
}
