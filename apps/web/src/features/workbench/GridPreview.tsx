import {
  useEffect,
  useRef,
  useState,
  type Ref,
  type ReactNode,
  type PointerEventHandler,
  type WheelEventHandler,
} from "react";

import type { BeadProject, Cell } from "../../domain/types";
import type { TargetColorStat } from "./colorStats";

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

interface GridPreviewProps {
  actions?: ReactNode;
  colorStats?: TargetColorStat[];
  contentRef?: Ref<HTMLDivElement>;
  focusedCell?: Cell | null;
  onContentSizeChange?: (size: PreviewContentSize) => void;
  onSourceImageSizeChange?: (size: SourceImageSize) => void;
  project: BeadProject;
  showReviewOverlay?: boolean;
  showColorStats?: boolean;
  sourceImageUrl?: string | null;
  transform?: PreviewTransform;
  dragging?: boolean;
  pannable?: boolean;
  target: boolean;
  title: string;
  viewportRef?: Ref<HTMLDivElement>;
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

export function GridPreview({
  actions = null,
  colorStats = [],
  contentRef = null,
  focusedCell = null,
  onContentSizeChange,
  onSourceImageSizeChange,
  project,
  showColorStats = false,
  showReviewOverlay = true,
  sourceImageUrl = null,
  transform = { zoom: 1, panX: 0, panY: 0 },
  dragging = false,
  pannable = false,
  target,
  title,
  viewportRef = null,
  onSelectCell,
  onViewportPointerCancel,
  onViewportPointerDown,
  onViewportPointerMove,
  onViewportPointerUp,
  onViewportWheel,
}: GridPreviewProps) {
  const sourceImageRef = useRef<HTMLImageElement | null>(null);
  const [sourceSize, setSourceSize] = useState<SourceImageSize | null>(null);
  const targetRgbByCode = new Map(
    colorStats
      .filter((stat) => stat.rgb)
      .map((stat) => [stat.code, stat.rgb]),
  );

  function setContentNode(node: HTMLDivElement | null) {
    if (typeof contentRef === "function") {
      contentRef(node);
    } else if (contentRef) {
      contentRef.current = node;
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

  const showSourceOverlay = !target && sourceImageUrl;

  return (
    <section className="preview-card">
      <header>
        <h3>{title}</h3>
        <div className="preview-card-actions">
          <span>{target ? "COCO" : "MARD"}</span>
          {actions}
        </div>
      </header>
      <div
        className={[
          "preview-viewport",
          pannable ? "is-pannable" : "",
          dragging ? "is-dragging" : "",
        ].filter(Boolean).join(" ")}
        ref={viewportRef}
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
              {showReviewOverlay && sourceSize ? (
                <svg
                  aria-label="待复核标记叠加层"
                  className="source-review-overlay"
                  viewBox={`0 0 ${sourceSize.width} ${sourceSize.height}`}
                >
                  {project.cells
                    .filter(
                      (cell) =>
                        cell.status === "review-required" ||
                        (focusedCell?.row === cell.row &&
                          focusedCell.column === cell.column),
                    )
                    .map((cell) => (
                      <rect
                        key={`${cell.row}-${cell.column}`}
                        className={[
                          "review-overlay-cell",
                          focusedCell?.row === cell.row &&
                          focusedCell.column === cell.column
                            ? "focused-cell"
                            : "",
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
                    ))}
                </svg>
              ) : null}
              {sourceSize ? (
                <svg
                  aria-label="原图格子选择层"
                  className="source-hit-overlay"
                  viewBox={`0 0 ${sourceSize.width} ${sourceSize.height}`}
                >
                  {project.cells
                    .filter((cell) => cell.status !== "empty")
                    .map((cell) => (
                      <rect
                        key={`${cell.row}-${cell.column}`}
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
              {project.cells.map((cell) => {
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
                    className={[
                      showReviewOverlay && cell.status === "review-required"
                        ? "review-cell"
                        : "",
                      showReviewOverlay &&
                      focusedCell?.row === cell.row &&
                      focusedCell.column === cell.column
                        ? "focused-cell"
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
                    {label ? (
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
