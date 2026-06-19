import type { BeadProject } from "../../domain/types";
import type { PreviewContentSize, PreviewTransform, SourceImageSize } from "./GridPreview";

export type PreviewSide = "source" | "target";

export interface CellBounds {
  startRow: number;
  startColumn: number;
  endRow: number;
  endColumn: number;
}

interface VisibleCellBoundsOptions {
  contentSize: PreviewContentSize;
  project: BeadProject;
  side: PreviewSide;
  sourceImageSize: SourceImageSize | null;
  transform: PreviewTransform;
  viewportSize: PreviewContentSize;
}

const TARGET_CELL_SIZE = 52;
const MIN_OVERSCAN_CELLS = 4;
const PREVIEW_CONTENT_MAX_HEIGHT = 475;

export function visibleCellBoundsForPreview({
  contentSize,
  project,
  side,
  sourceImageSize,
  transform,
  viewportSize,
}: VisibleCellBoundsOptions): CellBounds {
  const zoom = Math.max(transform.zoom, 0.001);
  const fittedSize = fittedContentSize(contentSize, viewportSize);
  const layoutOffsetX = (viewportSize.width - fittedSize.width) / 2;
  const layoutOffsetY = (viewportSize.height - fittedSize.height) / 2;
  const fittedVisibleLeft = Math.max(0, (-layoutOffsetX - transform.panX) / zoom);
  const fittedVisibleTop = Math.max(0, (-layoutOffsetY - transform.panY) / zoom);
  const fittedVisibleRight = Math.min(
    fittedSize.width,
    (viewportSize.width - layoutOffsetX - transform.panX) / zoom,
  );
  const fittedVisibleBottom = Math.min(
    fittedSize.height,
    (viewportSize.height - layoutOffsetY - transform.panY) / zoom,
  );
  const fittedScaleX = fittedSize.width / Math.max(contentSize.width, 1);
  const fittedScaleY = fittedSize.height / Math.max(contentSize.height, 1);
  const visibleLeft = Math.max(0, fittedVisibleLeft / Math.max(fittedScaleX, 0.001));
  const visibleTop = Math.max(0, fittedVisibleTop / Math.max(fittedScaleY, 0.001));
  const visibleRight = Math.min(
    contentSize.width,
    fittedVisibleRight / Math.max(fittedScaleX, 0.001),
  );
  const visibleBottom = Math.min(
    contentSize.height,
    fittedVisibleBottom / Math.max(fittedScaleY, 0.001),
  );

  if (side === "target") {
    const visibleRowCount = Math.ceil((visibleBottom - visibleTop) / TARGET_CELL_SIZE);
    const visibleColumnCount = Math.ceil((visibleRight - visibleLeft) / TARGET_CELL_SIZE);
    const overscanRows = overscanCells(visibleRowCount);
    const overscanColumns = overscanCells(visibleColumnCount);
    return clampBounds(project, {
      startRow: Math.floor(visibleTop / TARGET_CELL_SIZE) - overscanRows,
      startColumn: Math.floor(visibleLeft / TARGET_CELL_SIZE) - overscanColumns,
      endRow: Math.ceil(visibleBottom / TARGET_CELL_SIZE) + overscanRows,
      endColumn: Math.ceil(visibleRight / TARGET_CELL_SIZE) + overscanColumns,
    });
  }

  const sourceSize = sourceImageSize ?? {
    width: project.grid.bounds[2],
    height: project.grid.bounds[3],
  };
  const scaleX = sourceSize.width / Math.max(contentSize.width, 1);
  const scaleY = sourceSize.height / Math.max(contentSize.height, 1);
  const sourceLeft = visibleLeft * scaleX;
  const sourceTop = visibleTop * scaleY;
  const sourceRight = visibleRight * scaleX;
  const sourceBottom = visibleBottom * scaleY;

  const visibleRowCount = lineEndIndex(project.grid.y_lines, sourceBottom) -
    lineStartIndex(project.grid.y_lines, sourceTop) +
    1;
  const visibleColumnCount = lineEndIndex(project.grid.x_lines, sourceRight) -
    lineStartIndex(project.grid.x_lines, sourceLeft) +
    1;
  const overscanRows = overscanCells(visibleRowCount);
  const overscanColumns = overscanCells(visibleColumnCount);

  return clampBounds(project, {
    startRow: lineStartIndex(project.grid.y_lines, sourceTop) - overscanRows,
    startColumn: lineStartIndex(project.grid.x_lines, sourceLeft) - overscanColumns,
    endRow: lineEndIndex(project.grid.y_lines, sourceBottom) + overscanRows,
    endColumn: lineEndIndex(project.grid.x_lines, sourceRight) + overscanColumns,
  });
}

export function cellInBounds(
  cell: { row: number; column: number },
  bounds: CellBounds,
) {
  return (
    cell.row >= bounds.startRow &&
    cell.row <= bounds.endRow &&
    cell.column >= bounds.startColumn &&
    cell.column <= bounds.endColumn
  );
}

function clampBounds(project: BeadProject, bounds: CellBounds): CellBounds {
  return {
    startRow: clamp(bounds.startRow, 0, project.grid.rows - 1),
    startColumn: clamp(bounds.startColumn, 0, project.grid.columns - 1),
    endRow: clamp(bounds.endRow, 0, project.grid.rows - 1),
    endColumn: clamp(bounds.endColumn, 0, project.grid.columns - 1),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function fittedContentSize(
  contentSize: PreviewContentSize,
  viewportSize: PreviewContentSize,
) {
  if (contentSize.width <= 0 || contentSize.height <= 0) {
    return contentSize;
  }
  const availableHeight = Math.min(viewportSize.height, PREVIEW_CONTENT_MAX_HEIGHT);
  const scale = Math.min(
    viewportSize.width / contentSize.width,
    availableHeight / contentSize.height,
    1,
  );
  return {
    width: contentSize.width * scale,
    height: contentSize.height * scale,
  };
}

function overscanCells(visibleCellCount: number) {
  return Math.max(MIN_OVERSCAN_CELLS, Math.ceil(visibleCellCount));
}

function lineStartIndex(lines: number[], coordinate: number) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index + 1] > coordinate) {
      return index;
    }
  }
  return Math.max(0, lines.length - 2);
}

function lineEndIndex(lines: number[], coordinate: number) {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index] > coordinate) {
      return Math.max(0, index - 1);
    }
  }
  return Math.max(0, lines.length - 2);
}
