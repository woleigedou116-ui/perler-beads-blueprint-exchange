import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

import type { BeadProject, Cell } from "../../domain/types";
import { GridPreview, type PreviewTransform } from "./GridPreview";

interface FocusRequest {
  cell: Cell;
  nonce: number;
}

interface ComparisonPreviewProps {
  focusRequest?: FocusRequest | null;
  fullscreen: boolean;
  project: BeadProject;
  sourceImageUrl: string | null;
  onFullscreenChange: (next: boolean) => void;
  onSelectCell: (cell: Cell) => void;
}

type PreviewSide = "source" | "target";

interface DragStart {
  pointerId: number;
  side: PreviewSide;
  x: number;
  y: number;
  panX: number;
  panY: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
const FOCUS_ZOOM = 2;
const INITIAL_VIEW: PreviewTransform = { zoom: MIN_ZOOM, panX: 0, panY: 0 };

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

function initialViews(): Record<PreviewSide, PreviewTransform> {
  return {
    source: INITIAL_VIEW,
    target: INITIAL_VIEW,
  };
}

function pointerPoint(event: PointerEvent<HTMLDivElement>) {
  return {
    x: Number.isFinite(event.clientX) ? event.clientX : 0,
    y: Number.isFinite(event.clientY) ? event.clientY : 0,
  };
}

function focusedTransform(project: BeadProject, cell: Cell, side: PreviewSide): PreviewTransform {
  const centerX =
    side === "source"
      ? (project.grid.x_lines[cell.column] + project.grid.x_lines[cell.column + 1]) / 2
      : cell.column * 52 + 26;
  const centerY =
    side === "source"
      ? (project.grid.y_lines[cell.row] + project.grid.y_lines[cell.row + 1]) / 2
      : cell.row * 52 + 26;

  return {
    zoom: FOCUS_ZOOM,
    panX: 120 - centerX,
    panY: 120 - centerY,
  };
}

function sideTitle(side: PreviewSide) {
  return side === "source" ? "识别叠加视图" : "COCO 重绘预览";
}

export function ComparisonPreview({
  focusRequest = null,
  fullscreen,
  project,
  sourceImageUrl,
  onFullscreenChange,
  onSelectCell,
}: ComparisonPreviewProps) {
  const [views, setViews] = useState<Record<PreviewSide, PreviewTransform>>(initialViews);
  const [draggingSide, setDraggingSide] = useState<PreviewSide | null>(null);
  const [showReviewOverlay, setShowReviewOverlay] = useState(true);
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const dragStart = useRef<DragStart | null>(null);

  useEffect(() => {
    setViews(initialViews());
    setDraggingSide(null);
    setFocusedCell(null);
    dragStart.current = null;
  }, [project.id]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    setFocusedCell(focusRequest.cell);
    setViews({
      source: focusedTransform(project, focusRequest.cell, "source"),
      target: focusedTransform(project, focusRequest.cell, "target"),
    });
  }, [focusRequest, project]);

  function changeZoom(side: PreviewSide, delta: number) {
    setViews((current) => {
      const nextZoom = clampZoom(current[side].zoom + delta);
      return {
        ...current,
        [side]: {
          zoom: nextZoom,
          panX: nextZoom === MIN_ZOOM ? 0 : current[side].panX,
          panY: nextZoom === MIN_ZOOM ? 0 : current[side].panY,
        },
      };
    });
  }

  function fitToWindow(side: PreviewSide) {
    setViews((current) => ({
      ...current,
      [side]: INITIAL_VIEW,
    }));
  }

  function handleWheel(side: PreviewSide, event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    changeZoom(side, event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }

  function handlePointerDown(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    if (views[side].zoom <= MIN_ZOOM) {
      return;
    }
    const point = pointerPoint(event);
    dragStart.current = {
      pointerId: event.pointerId,
      side,
      x: point.x,
      y: point.y,
      panX: views[side].panX,
      panY: views[side].panY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingSide(side);
  }

  function handlePointerMove(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start || start.side !== side || start.pointerId !== event.pointerId) {
      return;
    }
    const point = pointerPoint(event);
    setViews((current) => ({
      ...current,
      [side]: {
        ...current[side],
        panX: start.panX + point.x - start.x,
        panY: start.panY + point.y - start.y,
      },
    }));
  }

  function handlePointerEnd(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current?.side !== side || dragStart.current.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragStart.current = null;
    setDraggingSide(null);
  }

  function controls(side: PreviewSide) {
    const title = sideTitle(side);
    return (
      <div className="preview-controls">
        <button
          type="button"
          aria-label={`${title} 缩小`}
          onClick={() => changeZoom(side, -ZOOM_STEP)}
        >
          -
        </button>
        <strong aria-label={`${title} 缩放比例`}>
          {Math.round(views[side].zoom * 100)}%
        </strong>
        <button
          type="button"
          aria-label={`${title} 放大`}
          onClick={() => changeZoom(side, ZOOM_STEP)}
        >
          +
        </button>
        <button
          type="button"
          aria-label={`${title} 适应窗口`}
          onClick={() => fitToWindow(side)}
        >
          适应窗口
        </button>
        {side === "source" ? (
          <button
            type="button"
            aria-label={showReviewOverlay ? "隐藏叠加" : "显示叠加"}
            onClick={() => setShowReviewOverlay((current) => !current)}
          >
            {showReviewOverlay ? "隐藏叠加" : "显示叠加"}
          </button>
        ) : null}
      </div>
    );
  }

  function viewportProps(side: PreviewSide) {
    return {
      dragging: draggingSide === side,
      pannable: views[side].zoom > MIN_ZOOM,
      transform: views[side],
      onViewportPointerCancel: (event: PointerEvent<HTMLDivElement>) =>
        handlePointerEnd(side, event),
      onViewportPointerDown: (event: PointerEvent<HTMLDivElement>) =>
        handlePointerDown(side, event),
      onViewportPointerMove: (event: PointerEvent<HTMLDivElement>) =>
        handlePointerMove(side, event),
      onViewportPointerUp: (event: PointerEvent<HTMLDivElement>) =>
        handlePointerEnd(side, event),
      onViewportWheel: (event: WheelEvent<HTMLDivElement>) => handleWheel(side, event),
    };
  }

  return (
    <section className="comparison-preview" aria-label="同步图纸预览">
      <div className="comparison-toolbar" aria-label="预览工具栏">
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
          {...viewportProps("source")}
          actions={controls("source")}
          focusedCell={focusedCell}
          project={project}
          showReviewOverlay={showReviewOverlay}
          sourceImageUrl={sourceImageUrl}
          target={false}
          title="识别叠加视图"
          onSelectCell={onSelectCell}
        />
        <GridPreview
          {...viewportProps("target")}
          actions={controls("target")}
          focusedCell={focusedCell}
          project={project}
          target
          title="COCO 重绘预览"
          onSelectCell={onSelectCell}
        />
      </div>
    </section>
  );
}
