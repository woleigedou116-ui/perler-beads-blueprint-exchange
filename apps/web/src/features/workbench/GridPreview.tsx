import { useEffect, useState } from "react";

import type { BeadProject, Cell } from "../../domain/types";

interface GridPreviewProps {
  project: BeadProject;
  sourceImageUrl?: string | null;
  target: boolean;
  title: string;
  onSelectCell: (cell: Cell) => void;
}

const CELL_SIZE = 52;

export function GridPreview({
  project,
  sourceImageUrl = null,
  target,
  title,
  onSelectCell,
}: GridPreviewProps) {
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    setSourceSize(null);
  }, [sourceImageUrl]);

  const showSourceOverlay = !target && sourceImageUrl;
  const sourceViewBox = sourceSize
    ? `0 0 ${sourceSize.width} ${sourceSize.height}`
    : `0 0 ${project.grid.bounds[2]} ${project.grid.bounds[3]}`;

  return (
    <section className="preview-card">
      <header>
        <h3>{title}</h3>
        <span>{target ? "COCO" : "MARD"}</span>
      </header>
      {showSourceOverlay ? (
        <div className="source-overlay-preview">
          <img
            alt="上传原图"
            className="source-overlay-image"
            src={sourceImageUrl}
            onLoad={(event) =>
              setSourceSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
          <svg
            aria-label="待复核标记叠加层"
            className="source-review-overlay"
            viewBox={sourceViewBox}
          >
            {project.cells
              .filter((cell) => cell.status === "review-required")
              .map((cell) => (
                <rect
                  key={`${cell.row}-${cell.column}`}
                  className="review-overlay-cell"
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
                className={cell.status === "review-required" ? "review-cell" : ""}
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
    </section>
  );
}
