import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
} from "react";

import type { BeadProject, Cell, PaletteMapping } from "../../domain/types";
import { Button } from "../../shared/ui";
import { buildTargetColorStats, type ColorStatSort } from "./colorStats";
import {
  GridPreview,
  type CellRegionBounds,
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
  selectedRegionBounds?: CellRegionBounds | null;
  sourceImageUrl: string | null;
  toolbarActions?: ReactNode;
  onFullscreenChange: (next: boolean) => void;
  onSelectCell: (cell: Cell) => void;
}

type PreviewSide = "source" | "target";

interface DragStart {
  cell: Cell | null;
  currentTransform: PreviewTransform;
  moved: boolean;
  pointerId: number;
  side: PreviewSide;
  x: number;
  y: number;
  panX: number;
  panY: number;
}

interface ZoomInteraction {
  commitTimer: number | null;
  transform: PreviewTransform;
}

interface TouchPoint {
  x: number;
  y: number;
}

interface PinchStart {
  distance: number;
  transform: PreviewTransform;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.25;
const ZOOM_COMMIT_DELAY_MS = 150;
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

function transformStyle(transform: PreviewTransform) {
  return `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`;
}

function pointerPoint(event: PointerEvent<HTMLDivElement>) {
  return {
    x: Number.isFinite(event.clientX) ? event.clientX : 0,
    y: Number.isFinite(event.clientY) ? event.clientY : 0,
  };
}

function distanceBetween(first: TouchPoint, second: TouchPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
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
  selectedRegionBounds = null,
  sourceImageUrl,
  toolbarActions = null,
  onFullscreenChange,
  onSelectCell,
}: ComparisonPreviewProps) {
  const [views, setViews] = useState<Record<PreviewSide, PreviewTransform>>(initialViews);
  const [interactingSide, setInteractingSide] = useState<PreviewSide | null>(null);
  const [showReviewOverlay, setShowReviewOverlay] = useState(true);
  const [showTargetReviewOverlay, setShowTargetReviewOverlay] = useState(true);
  const [showTargetCellLabels, setShowTargetCellLabels] = useState(true);
  const [showColorStats, setShowColorStats] = useState(true);
  const [focusedCell, setFocusedCell] = useState<Cell | null>(null);
  const [sourceImageSize, setSourceImageSize] = useState<SourceImageSize | null>(null);
  const [contentSizes, setContentSizes] = useState<Record<PreviewSide, PreviewContentSize | null>>({
    source: null,
    target: null,
  });
  const [viewportSizes, setViewportSizes] = useState<Record<PreviewSide, PreviewContentSize | null>>({
    source: null,
    target: null,
  });
  const viewportSizeRefs = useRef<Record<PreviewSide, PreviewContentSize | null>>({
    source: null,
    target: null,
  });
  const dragStart = useRef<DragStart | null>(null);
  const pendingTransformFrame = useRef<number | null>(null);
  const pendingTransforms = useRef<Partial<Record<PreviewSide, PreviewTransform>>>({});
  const zoomInteractions = useRef<Partial<Record<PreviewSide, ZoomInteraction>>>({});
  const touchPoints = useRef<Record<PreviewSide, Map<number, TouchPoint>>>({
    source: new Map(),
    target: new Map(),
  });
  const pinchStarts = useRef<Partial<Record<PreviewSide, PinchStart>>>({});
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
    setInteractingSide(null);
    setFocusedCell(null);
    setShowReviewOverlay(true);
    setShowTargetReviewOverlay(true);
    setShowTargetCellLabels(true);
    setShowColorStats(true);
    setSourceImageSize(null);
    setContentSizes({ source: null, target: null });
    setViewportSizes({ source: null, target: null });
    viewportSizeRefs.current = { source: null, target: null };
    touchPoints.current = { source: new Map(), target: new Map() };
    pinchStarts.current = {};
    dragStart.current = null;
    if (pendingTransformFrame.current !== null) {
      cancelAnimationFrame(pendingTransformFrame.current);
      pendingTransformFrame.current = null;
    }
    pendingTransforms.current = {};
    for (const interaction of Object.values(zoomInteractions.current)) {
      if (interaction?.commitTimer != null) {
        window.clearTimeout(interaction.commitTimer);
      }
    }
    zoomInteractions.current = {};
    return () => {
      if (pendingTransformFrame.current !== null) {
        cancelAnimationFrame(pendingTransformFrame.current);
        pendingTransformFrame.current = null;
      }
      pendingTransforms.current = {};
      for (const interaction of Object.values(zoomInteractions.current)) {
        if (interaction?.commitTimer != null) {
          window.clearTimeout(interaction.commitTimer);
        }
      }
      zoomInteractions.current = {};
      touchPoints.current = { source: new Map(), target: new Map() };
      pinchStarts.current = {};
      dragStart.current = null;
    };
  }, [project.id]);

  useEffect(() => {
    if (!focusRequest) {
      setFocusedCell(null);
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

  const targetColorStats = useMemo(
    () => buildTargetColorStats(project, paletteMappings, colorStatSort),
    [colorStatSort, paletteMappings, project],
  );

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

  function applyTransform(side: PreviewSide, transform: PreviewTransform) {
    const content = contentRefs.current[side];
    if (content) {
      content.style.transform = transformStyle(transform);
    }
  }

  function scheduleTransformWrite(side: PreviewSide, transform: PreviewTransform) {
    pendingTransforms.current[side] = transform;
    if (pendingTransformFrame.current !== null) {
      return;
    }
    pendingTransformFrame.current = requestAnimationFrame(() => {
      pendingTransformFrame.current = null;
      const transformsToApply = pendingTransforms.current;
      pendingTransforms.current = {};
      for (const [entrySide, entryTransform] of Object.entries(transformsToApply)) {
        applyTransform(entrySide as PreviewSide, entryTransform);
      }
    });
  }

  function cancelPendingTransformWrite() {
    if (pendingTransformFrame.current !== null) {
      cancelAnimationFrame(pendingTransformFrame.current);
      pendingTransformFrame.current = null;
    }
    pendingTransforms.current = {};
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

  function commitZoomInteraction(side: PreviewSide) {
    const interaction = zoomInteractions.current[side];
    if (!interaction) {
      return;
    }
    zoomInteractions.current[side] = undefined;
    applyTransform(side, interaction.transform);
    updateViewportSize(side, true);
    setViews((current) => ({
      ...current,
      [side]: interaction.transform,
    }));
    setInteractingSide((current) => (current === side ? null : current));
  }

  function previewZoomTo(side: PreviewSide, nextTransform: PreviewTransform) {
    const previousTimer = zoomInteractions.current[side]?.commitTimer;
    if (previousTimer !== undefined && previousTimer !== null) {
      window.clearTimeout(previousTimer);
    }
    scheduleTransformWrite(side, nextTransform);
    setInteractingSide(side);
    zoomInteractions.current[side] = {
      transform: nextTransform,
      commitTimer: window.setTimeout(() => commitZoomInteraction(side), ZOOM_COMMIT_DELAY_MS),
    };
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
    updateViewportSize(side, true);
    changeZoom(side, event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }

  function updateViewportSize(side: PreviewSide, commit = false) {
    const viewport = viewportRefs.current[side];
    if (!viewport) {
      return;
    }
    const size = measuredElementSize(viewport, { width: 0, height: 0 });
    viewportSizeRefs.current[side] = size;
    if (!commit) {
      return;
    }
    setViewportSizes((current) =>
      current[side]?.width === size.width && current[side]?.height === size.height
        ? current
        : { ...current, [side]: size },
    );
  }

  function canPan(side: PreviewSide) {
    if (views[side].zoom > MIN_ZOOM) {
      return true;
    }
    const content = contentRefs.current[side];
    const viewport = viewportRefs.current[side];
    const fallbackSize = contentSizes[side] ?? { width: 0, height: 0 };
    const contentSize = measuredContentSize(content, fallbackSize);
    const viewportSize = measuredElementSize(viewport, contentSize);
    return (
      contentSize.width > viewportSize.width + 1 ||
      contentSize.height > viewportSize.height + 1
    );
  }

  function handlePointerDown(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    const point = pointerPoint(event);
    if (event.pointerType === "touch") {
      const points = touchPoints.current[side];
      points.set(event.pointerId, point);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (points.size === 2) {
        const [first, second] = Array.from(points.values());
        pinchStarts.current[side] = {
          distance: distanceBetween(first, second),
          transform: zoomInteractions.current[side]?.transform ?? views[side],
        };
        dragStart.current = null;
        setInteractingSide(side);
      }
      return;
    }
    if (!canPan(side)) {
      return;
    }
    updateViewportSize(side);
    dragStart.current = {
      cell: cellFromEventTarget(project, event.target),
      currentTransform: views[side],
      moved: false,
      pointerId: event.pointerId,
      side,
      x: point.x,
      y: point.y,
      panX: views[side].panX,
      panY: views[side].panY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setInteractingSide(side);
  }

  function handlePointerMove(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      const points = touchPoints.current[side];
      if (!points.has(event.pointerId)) {
        return;
      }
      points.set(event.pointerId, pointerPoint(event));
      const pinchStart = pinchStarts.current[side];
      if (points.size < 2 || !pinchStart || pinchStart.distance <= 0) {
        return;
      }
      const [first, second] = Array.from(points.values());
      const nextZoom = clampZoom(
        pinchStart.transform.zoom * (distanceBetween(first, second) / pinchStart.distance),
      );
      previewZoomTo(side, zoomAroundViewportCenter(side, pinchStart.transform, nextZoom));
      return;
    }
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
    const nextTransform = {
      ...start.currentTransform,
      panX: start.panX + deltaX,
      panY: start.panY + deltaY,
    };
    start.currentTransform = nextTransform;
    scheduleTransformWrite(side, nextTransform);
  }

  function handlePointerEnd(side: PreviewSide, event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      touchPoints.current[side].delete(event.pointerId);
      if (touchPoints.current[side].size < 2) {
        pinchStarts.current[side] = undefined;
      }
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (touchPoints.current[side].size === 0 && !zoomInteractions.current[side]) {
        setInteractingSide(null);
      }
      return;
    }
    if (dragStart.current?.side !== side || dragStart.current.pointerId !== event.pointerId) {
      return;
    }
    const finalTransform = dragStart.current.currentTransform;
    cancelPendingTransformWrite();
    applyTransform(side, finalTransform);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!dragStart.current.moved && dragStart.current.cell) {
      onSelectCell(dragStart.current.cell);
    }
    dragStart.current = null;
    setViews((current) => ({
      ...current,
      [side]: finalTransform,
    }));
    setInteractingSide(null);
  }

  function controls(side: PreviewSide) {
    const title = sideTitle(side);
    return (
      <div className="preview-controls">
        <Button
          size="sm"
          type="button"
          variant="subtle"
          aria-label={`${title} 缩小`}
          onClick={() => changeZoom(side, -ZOOM_STEP)}
        >
          -
        </Button>
        <strong aria-label={`${title} 缩放比例`}>
          {Math.round(views[side].zoom * 100)}%
        </strong>
        <Button
          size="sm"
          type="button"
          variant="subtle"
          aria-label={`${title} 放大`}
          onClick={() => changeZoom(side, ZOOM_STEP)}
        >
          +
        </Button>
        <Button
          size="sm"
          type="button"
          variant="subtle"
          aria-label={`${title} 重置`}
          onClick={() => fitToWindow(side)}
        >
          重置
        </Button>
        {side === "source" ? (
          <Button
            size="sm"
            type="button"
            variant="subtle"
            aria-label={showReviewOverlay ? "隐藏叠加" : "显示叠加"}
            onClick={() => setShowReviewOverlay((current) => !current)}
          >
            {showReviewOverlay ? "隐藏叠加" : "显示叠加"}
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              type="button"
              variant="subtle"
              aria-label={
                showTargetReviewOverlay
                  ? `${title} 隐藏叠加`
                  : `${title} 显示叠加`
              }
              onClick={() => setShowTargetReviewOverlay((current) => !current)}
            >
              {showTargetReviewOverlay ? "隐藏叠加" : "显示叠加"}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="subtle"
              aria-label={
                showTargetCellLabels
                  ? `${title} 隐藏色号`
                  : `${title} 显示色号`
              }
              onClick={() => setShowTargetCellLabels((current) => !current)}
            >
              {showTargetCellLabels ? "隐藏色号" : "显示色号"}
            </Button>
            <Button
              size="sm"
              type="button"
              variant="subtle"
              aria-label={showColorStats ? "隐藏色块统计" : "显示色块统计"}
              onClick={() => setShowColorStats((current) => !current)}
            >
              {showColorStats ? "隐藏色块统计" : "显示色块统计"}
            </Button>
          </>
        )}
      </div>
    );
  }

  function viewportProps(side: PreviewSide) {
    return {
      dragging: interactingSide === side,
      pannable: canPan(side),
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
        <Button
          className="quiet-button"
          size="sm"
          type="button"
          variant="subtle"
          onClick={() => onFullscreenChange(!fullscreen)}
        >
          {fullscreen ? "退出全屏" : "全屏查看"}
        </Button>
        {toolbarActions ? (
          <div className="comparison-toolbar-actions">{toolbarActions}</div>
        ) : null}
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
          contentSize={contentSizes.source}
          project={project}
          selectedRegionBounds={selectedRegionBounds}
          showReviewOverlay={showReviewOverlay}
          sourceImageUrl={sourceImageUrl}
          target={false}
          title="识别叠加视图"
          viewportSize={viewportSizes.source ?? viewportSizeRefs.current.source}
          viewportRef={(node) => {
            viewportRefs.current.source = node;
            updateViewportSize("source");
          }}
          onSelectCell={onSelectCell}
        />
        <GridPreview
          {...viewportProps("target")}
          actions={controls("target")}
          colorStats={targetColorStats}
          contentRef={(node) => {
            contentRefs.current.target = node;
          }}
          focusedCell={focusedCell}
          onContentSizeChange={(size) =>
            setContentSizes((current) => ({ ...current, target: size }))
          }
          contentSize={contentSizes.target}
          project={project}
          selectedRegionBounds={selectedRegionBounds}
          showCellLabels={showTargetCellLabels}
          showColorStats={showColorStats}
          showReviewOverlay={showTargetReviewOverlay}
          target
          title="COCO 重绘预览"
          viewportSize={viewportSizes.target ?? viewportSizeRefs.current.target}
          viewportRef={(node) => {
            viewportRefs.current.target = node;
            updateViewportSize("target");
          }}
          onSelectCell={onSelectCell}
        />
      </div>
    </section>
  );
}
