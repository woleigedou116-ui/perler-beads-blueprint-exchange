import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";

import type { BeadProject, Cell, PaletteMapping } from "../../domain/types";
import { buildTargetColorStats, type ColorStatSort } from "./colorStats";
import {
  GridPreview,
  type PreviewContentSize,
  type PreviewTransform,
  type SourceImageSize,
} from "./GridPreview";

interface FocusRequest {
  cell: Cell;
  nonce: number;
}

interface ComparisonPreviewProps {
  colorStatSort?: ColorStatSort;
  focusRequest?: FocusRequest | null;
  fullscreen: boolean;
  project: BeadProject;
  paletteMappings?: PaletteMapping[];
  sourceImageUrl: string | null;
  onFullscreenChange: (next: boolean) => void;
  onSelectCell: (cell: Cell) => void;
}

type PreviewSide = "source" | "target";

interface DragStart {
  cell: Cell | null;
  moved: boolean;
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
const CLICK_MOVE_TOLERANCE = 4;
const PREVIEW_CONTENT_MAX_HEIGHT = 475;
const INITIAL_VIEW: PreviewTransform = { zoom: MIN_ZOOM, panX: 0, panY: 0 };
const DEFAULT_COLOR_STAT_SORT: ColorStatSort = {
  sortBy: "code",
  sortDirection: "asc",
};

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

function cellFromEventTarget(project: BeadProject, target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }
  const cellElement = target.closest("[data-cell-row][data-cell-column]");
  if (!cellElement) {
    return null;
  }
  const row = Number(cellElement.getAttribute("data-cell-row"));
  const column = Number(cellElement.getAttribute("data-cell-column"));
  if (!Number.isInteger(row) || !Number.isInteger(column)) {
    return null;
  }
  return (
    project.cells.find((cell) => cell.row === row && cell.column === column) ?? null
  );
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

function scaledToFit(
  naturalSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
) {
  if (naturalSize.width <= 0 || naturalSize.height <= 0) {
    return naturalSize;
  }
  const availableHeight = Math.min(viewportSize.height, PREVIEW_CONTENT_MAX_HEIGHT);
  const scale = Math.min(
    viewportSize.width / naturalSize.width,
    availableHeight / naturalSize.height,
    1,
  );
  return {
    width: naturalSize.width * scale,
    height: naturalSize.height * scale,
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
  viewportElement: HTMLDivElement | null,
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
  const measuredSize = measuredContentSize(contentElement, naturalSize);
  const viewportSize = measuredElementSize(viewportElement, measuredSize);
  const contentSize = scaledToFit(naturalSize, viewportSize);
  const layoutOffsetX = (viewportSize.width - contentSize.width) / 2;
  const layoutOffsetY = (viewportSize.height - contentSize.height) / 2;
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
    panX: Math.round(viewportSize.width / 2 - layoutOffsetX - centerX * zoom),
    panY: Math.round(viewportSize.height / 2 - layoutOffsetY - centerY * zoom),
  };
}

function sideTitle(side: PreviewSide) {
  return side === "source" ? "识别叠加视图" : "COCO 重绘预览";
}

export function ComparisonPreview({
  colorStatSort = DEFAULT_COLOR_STAT_SORT,
  focusRequest = null,
  fullscreen,
  paletteMappings = [],
  project,
  sourceImageUrl,
  onFullscreenChange,
  onSelectCell,
}: ComparisonPreviewProps) {
  const [views, setViews] = useState<Record<PreviewSide, PreviewTransform>>(initialViews);
  const [draggingSide, setDraggingSide] = useState<PreviewSide | null>(null);
  const [showReviewOverlay, setShowReviewOverlay] = useState(true);
  const [showTargetReviewOverlay, setShowTargetReviewOverlay] = useState(true);
  const [showColorStats, setShowColorStats] = useState(true);
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [sourceImageSize, setSourceImageSize] = useState<SourceImageSize | null>(null);
  const [contentSizes, setContentSizes] = useState<Record<PreviewSide, PreviewContentSize | null>>({
    source: null,
    target: null,
  });
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
    setShowReviewOverlay(true);
    setShowTargetReviewOverlay(true);
    setShowColorStats(true);
    setSourceImageSize(null);
    setContentSizes({ source: null, target: null });
    dragStart.current = null;
  }, [project.id]);

  useEffect(() => {
    if (!focusRequest) {
      return;
    }
    setFocusedCell(focusRequest.cell);
    setViews({
      source: focusedTransform(
        project,
        focusRequest.cell,
        "source",
        contentRefs.current.source,
        viewportRefs.current.source,
        sourceImageSize,
        views.source.zoom,
      ),
      target: focusedTransform(
        project,
        focusRequest.cell,
        "target",
        contentRefs.current.target,
        viewportRefs.current.target,
        sourceImageSize,
        views.target.zoom,
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
    const fallbackSize = contentSizes[side] ?? measuredContentSize(content, { width: 1, height: 1 });
    const viewportSize = measuredElementSize(viewport, fallbackSize);
    const contentSize = scaledToFit(fallbackSize, viewportSize);
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
    event.stopPropagation();
    changeZoom(side, event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }

  function handlePointerDown(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    if (views[side].zoom <= MIN_ZOOM) {
      return;
    }
    const point = pointerPoint(event);
    dragStart.current = {
      cell: cellFromEventTarget(project, event.target),
      moved: false,
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
    const deltaX = point.x - start.x;
    const deltaY = point.y - start.y;
    if (Math.hypot(deltaX, deltaY) > CLICK_MOVE_TOLERANCE) {
      start.moved = true;
    }
    setViews((current) => ({
      ...current,
      [side]: {
        ...current[side],
        panX: start.panX + deltaX,
        panY: start.panY + deltaY,
      },
    }));
  }

  function handlePointerEnd(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current?.side !== side || dragStart.current.pointerId !== event.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!dragStart.current.moved && dragStart.current.cell) {
      onSelectCell(dragStart.current.cell);
    }
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
        ) : (
          <>
            <button
              type="button"
              aria-label={
                showTargetReviewOverlay
                  ? `${title} 隐藏叠加`
                  : `${title} 显示叠加`
              }
              onClick={() => setShowTargetReviewOverlay((current) => !current)}
            >
              {showTargetReviewOverlay ? "隐藏叠加" : "显示叠加"}
            </button>
            <button
              type="button"
              aria-label={showColorStats ? "隐藏色块统计" : "显示色块统计"}
              onClick={() => setShowColorStats((current) => !current)}
            >
              {showColorStats ? "隐藏色块统计" : "显示色块统计"}
            </button>
          </>
        )}
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
    <section className="comparison-preview" aria-label="图纸预览">
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
          onContentSizeChange={(size) =>
            setContentSizes((current) => ({ ...current, source: size }))
          }
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
          colorStats={buildTargetColorStats(project, paletteMappings, colorStatSort)}
          contentRef={(node) => {
            contentRefs.current.target = node;
          }}
          focusedCell={focusedCell}
          onContentSizeChange={(size) =>
            setContentSizes((current) => ({ ...current, target: size }))
          }
          project={project}
          showColorStats={showColorStats}
          showReviewOverlay={showTargetReviewOverlay}
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
