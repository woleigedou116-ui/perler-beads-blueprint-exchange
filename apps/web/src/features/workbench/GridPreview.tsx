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

export interface PreviewTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface SourceImageSize {
  width: number;
  height: number;
}

interface GridPreviewProps {
  actions?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  focusedCell?: Cell | null;
  onSourceImageSizeChange?: (size: SourceImageSize) => void;
  project: BeadProject;
  showReviewOverlay?: boolean;
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

export function GridPreview({
  actions = null,
  contentRef = null,
  focusedCell = null,
  onSourceImageSizeChange,
  project,
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
  }

  useEffect(() => {
    setSourceSize(null);
    const image = sourceImageRef.current;
    if (image?.complete) {
      updateSourceSize(image);
    }
  }, [sourceImageUrl]);

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
          ref={contentRef}
          style={{
            transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
          }}
        >
          {showSourceOverlay ? (
            <div className="source-overlay-preview">
              <img
                alt="上传原图"
                className="source-overlay-image"
                ref={sourceImageRef}
                src={sourceImageUrl}
                onLoad={(event) => updateSourceSize(event.currentTarget)}
              />
              {showReviewOverlay && sourceSize ? (
                <svg
                  aria-label="待复核标记叠加层"
                  className="source-review-overlay"
                  viewBox={`0 0 ${sourceSize.width} ${sourceSize.height}`}
                >
                  {project.cells
                    .filter((cell) => cell.status === "review-required")
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
              viewBox={`0 0 ${project.grid.columns * CELL_SIZE} ${project.grid.rows * CELL_SIZE}`}
            >
              {project.cells.map((cell) => {
                const rgb = cell.sampled_color;
                const label = target
                  ? cell.target_code
                  : cell.confirmed_source_code ?? cell.detected_source_code;
                return (
                  <g
                    key={`${cell.row}-${cell.column}`}
                    className={[
                      cell.status === "review-required" ? "review-cell" : "",
                      focusedCell?.row === cell.row && focusedCell.column === cell.column
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
    </section>
  );
}
