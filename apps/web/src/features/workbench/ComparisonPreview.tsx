import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

import type { BeadProject, Cell } from "../../domain/types";
import { GridPreview, type PreviewTransform, type SourceImageSize } from "./GridPreview";

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
const MAX_ZOOM = 8;
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

function measuredContentSize(
  element: HTMLDivElement | null,
  fallback: { width: number; height: number },
) {
  if (!element) {
    return fallback;
  }
  const rect = element.getBoundingClientRect();
  return {
    width: element.clientWidth || rect.width || fallback.width,
    height: element.clientHeight || rect.height || fallback.height,
  };
}

function measuredElementSize(
  element: HTMLDivElement | null,
  fallback: { width: number; height: number },
) {
  if (!element) {
    return fallback;
  }
  const rect = element.getBoundingClientRect();
  return {
    width: element.clientWidth || rect.width || fallback.width,
    height: element.clientHeight || rect.height || fallback.height,
  };
}

function sourceCellCenter(project: BeadProject, cell: Cell) {
  return {
    x: (project.grid.x_lines[cell.column] + project.grid.x_lines[cell.column + 1]) / 2,
    y: (project.grid.y_lines[cell.row] + project.grid.y_lines[cell.row + 1]) / 2,
  };
}

function targetCellCenter(cell: Cell) {
  return {
    x: cell.column * 52 + 26,
    y: cell.row * 52 + 26,
  };
}

function focusedTransform(
  project: BeadProject,
  cell: Cell,
  side: PreviewSide,
  contentElement: HTMLDivElement | null,
  sourceImageSize: SourceImageSize | null,
  zoom: number,
): PreviewTransform {
  const targetViewSize = {
    width: project.grid.columns * 52,
    height: project.grid.rows * 52,
  };
  const sourceFallbackSize = sourceImageSize ?? {
    width: project.grid.bounds[2],
    height: project.grid.bounds[3],
  };
  const naturalSize = side === "source" ? sourceFallbackSize : targetViewSize;
  const contentSize = measuredContentSize(contentElement, naturalSize);
  const centerX =
    side === "source"
      ? sourceCellCenter(project, cell).x * (contentSize.width / naturalSize.width)
      : targetCellCenter(cell).x * (contentSize.width / targetViewSize.width);
  const centerY =
    side === "source"
      ? sourceCellCenter(project, cell).y * (contentSize.height / naturalSize.height)
      : targetCellCenter(cell).y * (contentSize.height / targetViewSize.height);

  return {
    zoom,
    panX: Math.round(contentSize.width / 2 - centerX * zoom),
    panY: Math.round(contentSize.height / 2 - centerY * zoom),
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
  const [sourceImageSize, setSourceImageSize] = useState<SourceImageSize | null>(null);
  const dragStart = useRef<DragStart | null>(null);
  const contentRefs = useRef<Record<PreviewSide, HTMLDivElement | null>>({
    source: null,
    target: null,
  });
  const viewportRefs = useRef<Record<PreviewSide, HTMLDivElement | null>>({
    source: null,
    target: null,
  });

  useEffect(() => {
    setViews(initialViews());
    setDraggingSide(null);
    setFocusedCell(null);
    setSourceImageSize(null);
    dragStart.current = null;
  }, [project.id]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    const focusZoom = views.source.zoom > MIN_ZOOM ? views.source.zoom : FOCUS_ZOOM;
    setFocusedCell(focusRequest.cell);
    setViews({
      source: focusedTransform(
        project,
        focusRequest.cell,
        "source",
        contentRefs.current.source,
        sourceImageSize,
        focusZoom,
      ),
      target: focusedTransform(
        project,
        focusRequest.cell,
        "target",
        contentRefs.current.target,
        sourceImageSize,
        focusZoom,
      ),
    });
  }, [focusRequest, project, sourceImageSize]);

  function zoomAroundViewportCenter(
    side: PreviewSide,
    current: PreviewTransform,
    nextZoom: number,
  ): PreviewTransform {
    if (nextZoom === MIN_ZOOM) {
      return INITIAL_VIEW;
    }
    if (nextZoom === current.zoom) {
      return current;
    }

    const content = contentRefs.current[side];
    const viewport = viewportRefs.current[side];
    const fallbackSize = measuredContentSize(content, { width: 1, height: 1 });
    const viewportSize = measuredElementSize(viewport, fallbackSize);
    const contentSize = measuredContentSize(content, viewportSize);
    const layoutOffsetX = (viewportSize.width - contentSize.width) / 2;
    const layoutOffsetY = (viewportSize.height - contentSize.height) / 2;
    const viewportCenterX = viewportSize.width / 2;
    const viewportCenterY = viewportSize.height / 2;
    const anchoredContentX =
      (viewportCenterX - layoutOffsetX - current.panX) / current.zoom;
    const anchoredContentY =
      (viewportCenterY - layoutOffsetY - current.panY) / current.zoom;

    return {
      zoom: nextZoom,
      panX: Math.round(viewportCenterX - layoutOffsetX - anchoredContentX * nextZoom),
      panY: Math.round(viewportCenterY - layoutOffsetY - anchoredContentY * nextZoom),
    };
  }

  function changeZoom(side: PreviewSide, delta: number) {
    setViews((current) => {
      const nextZoom = clampZoom(current[side].zoom + delta);
      return {
        ...current,
        [side]: zoomAroundViewportCenter(side, current[side], nextZoom),
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
        <button type="button" aria-label={`${title} 重置`} onClick={() => fitToWindow(side)}>
          重置
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
          contentRef={(node) => {
            contentRefs.current.source = node;
          }}
          focusedCell={focusedCell}
          onSourceImageSizeChange={setSourceImageSize}
          project={project}
          showReviewOverlay={showReviewOverlay}
          sourceImageUrl={sourceImageUrl}
          target={false}
          title="识别叠加视图"
          viewportRef={(node) => {
            viewportRefs.current.source = node;
          }}
          onSelectCell={onSelectCell}
        />
        <GridPreview
          {...viewportProps("target")}
          actions={controls("target")}
          contentRef={(node) => {
            contentRefs.current.target = node;
          }}
          focusedCell={focusedCell}
          project={project}
          target
          title="COCO 重绘预览"
          viewportRef={(node) => {
            viewportRefs.current.target = node;
          }}
          onSelectCell={onSelectCell}
        />
      </div>
    </section>
  );
}
