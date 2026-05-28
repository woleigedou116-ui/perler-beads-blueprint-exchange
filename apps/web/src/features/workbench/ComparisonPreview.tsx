import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

import type { BeadProject, Cell } from "../../domain/types";
import { GridPreview, type PreviewTransform } from "./GridPreview";

interface ComparisonPreviewProps {
  fullscreen: boolean;
  project: BeadProject;
  sourceImageUrl: string | null;
  onFullscreenChange: (next: boolean) => void;
  onSelectCell: (cell: Cell) => void;
}

interface DragStart {
  pointerId: number;
  x: number;
  y: number;
  panX: number;
  panY: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const INITIAL_VIEW: PreviewTransform = { zoom: MIN_ZOOM, panX: 0, panY: 0 };

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function pointerPoint(event: PointerEvent<HTMLDivElement>) {
  return {
    x: Number.isFinite(event.clientX) ? event.clientX : 0,
    y: Number.isFinite(event.clientY) ? event.clientY : 0,
  };
}

export function ComparisonPreview({
  fullscreen,
  project,
  sourceImageUrl,
  onFullscreenChange,
  onSelectCell,
}: ComparisonPreviewProps) {
  const [transform, setTransform] = useState<PreviewTransform>(INITIAL_VIEW);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<DragStart | null>(null);

  useEffect(() => {
    setTransform(INITIAL_VIEW);
    setDragging(false);
    dragStart.current = null;
  }, [project.id]);

  function changeZoom(delta: number) {
    setTransform((current) => {
      const nextZoom = clampZoom(current.zoom + delta);
      return {
        zoom: nextZoom,
        panX: nextZoom === MIN_ZOOM ? 0 : current.panX,
        panY: nextZoom === MIN_ZOOM ? 0 : current.panY,
      };
    });
  }

  function fitToWindow() {
    setTransform(INITIAL_VIEW);
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (transform.zoom <= MIN_ZOOM) {
      return;
    }
    const point = pointerPoint(event);
    dragStart.current = {
      pointerId: event.pointerId,
      x: point.x,
      y: point.y,
      panX: transform.panX,
      panY: transform.panY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }
    const point = pointerPoint(event);
    setTransform((current) => ({
      ...current,
      panX: start.panX + point.x - start.x,
      panY: start.panY + point.y - start.y,
    }));
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current?.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStart.current = null;
    setDragging(false);
  }

  const viewportProps = {
    dragging,
    pannable: transform.zoom > MIN_ZOOM,
    transform,
    onViewportPointerCancel: handlePointerEnd,
    onViewportPointerDown: handlePointerDown,
    onViewportPointerMove: handlePointerMove,
    onViewportPointerUp: handlePointerEnd,
    onViewportWheel: handleWheel,
  };

  return (
    <section className="comparison-preview" aria-label="同步图纸预览">
      <div className="comparison-toolbar" aria-label="预览缩放工具栏">
        <div className="zoom-actions">
          <button type="button" aria-label="缩小" onClick={() => changeZoom(-ZOOM_STEP)}>
            -
          </button>
          <strong>{Math.round(transform.zoom * 100)}%</strong>
          <button type="button" aria-label="放大" onClick={() => changeZoom(ZOOM_STEP)}>
            +
          </button>
          <button type="button" onClick={fitToWindow}>
            适应窗口
          </button>
        </div>
        <button
          className="quiet-button"
          type="button"
          onClick={() => onFullscreenChange(!fullscreen)}
        >
          {fullscreen ? "退出全屏" : "全屏查看"}
        </button>
      </div>
      <div className="preview-row">
        <GridPreview
          {...viewportProps}
          project={project}
          sourceImageUrl={sourceImageUrl}
          target={false}
          title="识别叠加视图"
          onSelectCell={onSelectCell}
        />
        <GridPreview
          {...viewportProps}
          project={project}
          target
          title="COCO 重绘预览"
          onSelectCell={onSelectCell}
        />
      </div>
    </section>
  );
}
