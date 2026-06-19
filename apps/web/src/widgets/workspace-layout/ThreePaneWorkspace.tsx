import type { ReactNode } from "react";

import { cn } from "../../shared/lib/cn";

export type ThreePaneWorkspaceProps = {
  center: ReactNode;
  className?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function ThreePaneWorkspace({
  center,
  className,
  left,
  right,
}: ThreePaneWorkspaceProps) {
  return (
    <div className={cn("three-pane-workspace", className)}>
      {left ? <aside className="three-pane-workspace-left">{left}</aside> : null}
      <section className="three-pane-workspace-center">{center}</section>
      {right ? <aside className="three-pane-workspace-right">{right}</aside> : null}
    </div>
  );
}
