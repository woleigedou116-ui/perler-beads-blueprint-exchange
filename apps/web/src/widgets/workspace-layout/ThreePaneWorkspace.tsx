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
      {left ? <div className="three-pane-workspace-left">{left}</div> : null}
      <div className="three-pane-workspace-center">{center}</div>
      {right ? <div className="three-pane-workspace-right">{right}</div> : null}
    </div>
  );
}
