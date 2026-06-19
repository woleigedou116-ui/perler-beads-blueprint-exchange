import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
  type ReactNode,
  type PointerEventHandler,
  type WheelEventHandler,
} from "react";

import type { BeadProject, Cell } from "../../domain/types";
import type { TargetColorStat } from "./colorStats";
import {
  cellInBounds,
  visibleCellBoundsForPreview,
  type PreviewSide,
} from "./previewVirtualization";

export interface PreviewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface SourceImageSize {
  width: number;
  height: number;
}

export interface PreviewContentSize {
  width: number;
  height: number;
}

export interface CellRegionBounds {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

interface GridPreviewProps {
  actions?: ReactNode;
  colorStats?: TargetColorStat[];
  contentSize?: PreviewContentSize | null;
  contentRef?: Ref<HTMLDivElement>;
  focusedCell?: Cell | null;
  onContentSizeChange?: (size: PreviewContentSize) => void;
  onSourceImageSizeChange?: (size: SourceImageSize) => void;
  project: BeadProject;
  showReviewOverlay?: boolean;
  showColorStats?: boolean;
  showCellLabels?: boolean;
  sourceImageUrl?: string | null;
  selectedRegionBounds?: CellRegionBounds | null;
  transform?: PreviewTransform;
  dragging?: boolean;
  pannable?: boolean;
  target: boolean;
  title: string;
  viewportRef?: Ref<HTMLDivElement>;
  viewportSize?: PreviewContentSize | null;
  onSelectCell: (cell: Cell) => void;
  onViewportPointerCancel?: PointerEventHandler<HTMLDivElement>;
  onViewportPointerDown?: PointerEventHandler<HTMLDivElement>;
  onViewportPointerMove?: PointerEventHandler<HTMLDivElement>;
  onViewportPointerUp?: PointerEventHandler<HTMLDivElement>;
  onViewportWheel?: WheelEventHandler<HTMLDivElement>;
}

const CELL_SIZE = 52;
const DARK_TEXT = "rgb(25, 25, 25)";
const LIGHT_TEXT = "rgb(255, 255, 255)";

function perceivedBrightness(rgb: { r: number; g: number; b: number }) {
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

function labelStyle(rgb: { r: number; g: number; b: number } | null) {
  const isDark = rgb ? perceivedBrightness(rgb) < 145 : false;
  return {
    fill: isDark ? LIGHT_TEXT : DARK_TEXT,
    stroke: isDark ? DARK_TEXT : LIGHT_TEXT,
  };
}

function cellInRegion(cell: Cell, bounds: CellRegionBounds | null) {
  return (
    bounds !== null &&
    cell.row >= bounds.startRow &&
    cell.row <= bounds.endRow &&
    cell.column >= bounds.startColumn &&
    cell.column <= bounds.endColumn
  );
}

function validSize(size: PreviewContentSize | null) {
  return size && size.width > 0 && size.height > 0 ? size : null;
}

export function GridPreview({
  actions = null,
  colorStats = [],
  contentSize = null,
  contentRef = null,
  focusedCell = null,
  onContentSizeChange,
  onSourceImageSizeChange,
  project,
  selectedRegionBounds = null,
  showCellLabels = true,
  showColorStats = false,
  showReviewOverlay = true,
  sourceImageUrl = null,
  transform = { zoom: 1, panX: 0, panY: 0 },
  dragging = false,
  pannable = false,
  target,
  title,
  viewportRef = null,
  viewportSize = null,
  onSelectCell,
  onViewportPointerCancel,
  onViewportPointerDown,
  onViewportPointerMove,
  onViewportPointerUp,
  onViewportWheel,
}: GridPreviewProps) {
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const viewportNodeRef = useRef<HTMLDivElement | null>(null);
  const [sourceSize, setSourceSize] = useState<SourceImageSize | null>(null);
  const [measuredViewportSize, setMeasuredViewportSize] =
    useState<PreviewContentSize | null>(null);
  const targetRgbByCode = useMemo(
    () =>
      new Map(
        colorStats
          .filter((stat) => stat.rgb)
          .map((stat) => [stat.code, stat.rgb]),
      ),
    [colorStats],
  );
  const naturalContentSize =
    contentSize ??
    (target
      ? {
          width: project.grid.columns * CELL_SIZE,
          height: project.grid.rows * CELL_SIZE,
        }
      : sourceSize);
  const effectiveViewportSize =
    validSize(viewportSize) ?? validSize(measuredViewportSize);
  const visibleBounds = useMemo(
    () =>
      naturalContentSize && effectiveViewportSize
        ? visibleCellBoundsForPreview({
            contentSize: naturalContentSize,
            project,
            side: (target ? "target" : "source") satisfies PreviewSide,
            sourceImageSize: sourceSize,
            transform,
            viewportSize: effectiveViewportSize,
          })
        : null,
    [effectiveViewportSize, naturalContentSize, project, sourceSize, target, transform],
  );
  const visibleCells = useMemo(
    () => {
      if (!visibleBounds) {
        return project.cells;
      }
      const cellsByKey = new Map<string, Cell>();
      for (const cell of project.cells) {
        if (
          cellInBounds(cell, visibleBounds) ||
          cellInRegion(cell, selectedRegionBounds) ||
          (focusedCell?.row === cell.row && focusedCell.column === cell.column)
        ) {
          cellsByKey.set(`${cell.row}-${cell.column}`, cell);
        }
      }
      return Array.from(cellsByKey.values());
    },
    [focusedCell, project.cells, selectedRegionBounds, visibleBounds],
  );

  function setContentNode(node: HTMLDivElement | null) {
    if (typeof contentRef === "function") {
      contentRef(node);
    } else if (contentRef) {
      contentRef.current = node;
    }
  }

  function publishViewportSize(node: HTMLDivElement) {
    const rect = node.getBoundingClientRect();
    const next = {
      width: node.clientWidth || rect.width,
      height: node.clientHeight || rect.height,
    };
    if (!validSize(next)) {
      return;
    }
    setMeasuredViewportSize((current) =>
      current?.width === next.width && current.height === next.height ? current : next,
    );
  }

  function setViewportNode(node: HTMLDivElement | null) {
    viewportNodeRef.current = node;
    if (typeof viewportRef === "function") {
      viewportRef(node);
    } else if (viewportRef) {
      viewportRef.current = node;
    }
    if (node) {
      publishViewportSize(node);
    }
  }

  function publishContentSize(size: PreviewContentSize) {
    onContentSizeChange?.(size);
  }

  function updateSourceSize(image: HTMLImageElement) {
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      return;
    }
    const next = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
    setSourceSize(next);
    onSourceImageSizeChange?.(next);
    publishContentSize(next);
  }

  useEffect(() => {
    setSourceSize(null);
    const image = sourceImageRef.current;
    if (image?.complete) {
      updateSourceSize(image);
    }
  }, [sourceImageUrl]);

  useEffect(() => {
    if (target) {
      publishContentSize({
        width: project.grid.columns * CELL_SIZE,
        height: project.grid.rows * CELL_SIZE,
      });
    }
  }, [project.id, project.grid.columns, project.grid.rows, target]);

  useEffect(() => {
    const node = viewportNodeRef.current;
    if (!node) {
      return;
    }
    publishViewportSize(node);
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => publishViewportSize(node));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const showSourceOverlay = !target && sourceImageUrl;

  return (
    <section className="preview-card">
      <header className="preview-card-header">
        <div className="preview-card-title-row">
          <h3 className="preview-card-title">{title}</h3>
          <span className="preview-standard-pill">{target ? "COCO" : "MARD"}</span>
        </div>
        <div className="preview-card-actions">
          {actions}
        </div>
      </header>
      <div
        className={[
          "preview-viewport",
          pannable ? "is-pannable" : "",
          dragging ? "is-interacting" : "",
        ].filter(Boolean).join(" ")}
        ref={setViewportNode}
        onPointerCancel={onViewportPointerCancel}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onWheel={onViewportWheel}
      >
        <div
          className="preview-transform"
          ref={setContentNode}
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
          }}
        >
          {showSourceOverlay ? (
            <div className="source-overlay-preview">
              <img
                alt="上传原图"
                className="source-overlay-image"
                draggable={false}
                width={sourceSize?.width}
                height={sourceSize?.height}
                ref={sourceImageRef}
                src={sourceImageUrl}
                onDragStart={(event) => event.preventDefault()}
                onLoad={(event) => updateSourceSize(event.currentTarget)}
              />
              {(showReviewOverlay || selectedRegionBounds) && sourceSize ? (
                <svg
                  aria-label="待复核标记叠加层"
                  className="source-review-overlay"
                  viewBox={`0 0 ${sourceSize.width} ${sourceSize.height}`}
                >
                  {visibleCells
                    .filter(
                      (cell) =>
                        (showReviewOverlay && cell.status === "review-required") ||
                        cellInRegion(cell, selectedRegionBounds) ||
                        (showReviewOverlay &&
                          focusedCell?.row === cell.row &&
                          focusedCell.column === cell.column),
                    )
                    .map((cell) => {
                      const isFocused =
                        focusedCell?.row === cell.row &&
                        focusedCell.column === cell.column;
                      return (
                        <rect
                          key={`${cell.row}-${cell.column}`}
                          className={[
                            "review-overlay-cell",
                            cellInRegion(cell, selectedRegionBounds)
                              ? "region-selected-cell"
                              : "",
                            isFocused ? "focused-cell" : "",
                          ].filter(Boolean).join(" ")}
                          x={project.grid.x_lines[cell.column]}
                          y={project.grid.y_lines[cell.row]}
                          width={
                            project.grid.x_lines[cell.column + 1] -
                            project.grid.x_lines[cell.column]
                          }
                          height={
                            project.grid.y_lines[cell.row + 1] -
                            project.grid.y_lines[cell.row]
                          }
                        />
                      );
                    })}
                </svg>
              ) : null}
              {sourceSize ? (
                <svg
                  aria-label="原图格子选择层"
                  className="source-hit-overlay"
                  viewBox={`0 0 ${sourceSize.width} ${sourceSize.height}`}
                >
                  {visibleCells.map((cell) => (
                    <rect
                      key={`${cell.row}-${cell.column}`}
                      data-cell-column={cell.column}
                      data-cell-row={cell.row}
                      className="source-hit-cell"
                      x={project.grid.x_lines[cell.column]}
                      y={project.grid.y_lines[cell.row]}
                      width={
                        project.grid.x_lines[cell.column + 1] -
                        project.grid.x_lines[cell.column]
                      }
                      height={
                        project.grid.y_lines[cell.row + 1] -
                        project.grid.y_lines[cell.row]
                      }
                      onClick={() => onSelectCell(cell)}
                    />
                  ))}
                </svg>
              ) : null}
            </div>
          ) : (
            <svg
              className="grid-preview"
              role="img"
              aria-label={title}
              width={project.grid.columns * CELL_SIZE}
              height={project.grid.rows * CELL_SIZE}
              viewBox={`0 0 ${project.grid.columns * CELL_SIZE} ${project.grid.rows * CELL_SIZE}`}
            >
              {visibleCells.map((cell) => {
                const rgb =
                  target && cell.target_code
                    ? targetRgbByCode.get(cell.target_code) ?? cell.sampled_color
                    : cell.sampled_color;
                const label = target
                  ? cell.target_code
                  : cell.confirmed_source_code ?? cell.detected_source_code;
                return (
                  <g
                    key={`${cell.row}-${cell.column}`}
                    data-cell-column={cell.column}
                    data-cell-row={cell.row}
                    className={[
                      showReviewOverlay && cell.status === "review-required"
                        ? "review-cell"
                        : "",
                      showReviewOverlay &&
                      focusedCell?.row === cell.row &&
                      focusedCell.column === cell.column
                        ? "focused-cell"
                        : "",
                      cellInRegion(cell, selectedRegionBounds)
                        ? "region-selected-cell"
                        : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => onSelectCell(cell)}
                  >
                    <rect
                      x={cell.column * CELL_SIZE}
                      y={cell.row * CELL_SIZE}
                      width={CELL_SIZE}
                      height={CELL_SIZE}
                      fill={
                        cell.status === "empty" || !rgb
                          ? "#ffffff"
                          : `rgb(${rgb.r} ${rgb.g} ${rgb.b})`
                      }
                    />
                    {showCellLabels && label ? (
                      <text
                        paintOrder="stroke"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          ...labelStyle(rgb),
                          fontSize: target ? "16px" : "12px",
                        }}
                        x={cell.column * CELL_SIZE + CELL_SIZE / 2}
                        y={cell.row * CELL_SIZE + CELL_SIZE / 2 + 4}
                        textAnchor="middle"
                      >
                        {label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
      {target && showColorStats ? (
        <div className="target-color-stats" aria-label="COCO 色块统计">
          {colorStats.map((stat) => (
            <div className="target-color-stat" key={stat.code}>
              <span
                aria-label={`${stat.code} 色块`}
                className="target-color-swatch"
                style={{
                  backgroundColor: stat.rgb
                    ? `rgb(${stat.rgb.r} ${stat.rgb.g} ${stat.rgb.b})`
                    : "#f5f5f5",
                }}
              />
              <strong>{stat.code}</strong>
              <small>{stat.count}</small>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
