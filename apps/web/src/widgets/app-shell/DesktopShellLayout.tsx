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
      {topBar ? <div className="desktop-shell-topbar">{topBar}</div> : null}
      <div className="desktop-shell-body">{body}</div>
      {statusBar ? <div className="desktop-shell-statusbar">{statusBar}</div> : null}
    </main>
  );
}
