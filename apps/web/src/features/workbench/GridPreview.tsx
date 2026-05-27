import type { BeadProject, Cell } from "../../domain/types";

interface GridPreviewProps {
  project: BeadProject;
  target: boolean;
  title: string;
  onSelectCell: (cell: Cell) => void;
}

const CELL_SIZE = 52;

export function GridPreview({
  project,
  target,
  title,
  onSelectCell,
}: GridPreviewProps) {
  return (
    <section className="preview-card">
      <header>
        <h3>{title}</h3>
        <span>{target ? "COCO" : "MARD"}</span>
      </header>
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
    </section>
  );
}
