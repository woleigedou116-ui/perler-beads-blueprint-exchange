import type { Cell } from "../../domain/types";

export interface ReviewGroup {
  key: string;
  source: string;
  target: string;
  issueReasons: string[];
  cells: Cell[];
}

export function sourceForGroup(cell: Cell) {
  return cell.confirmed_source_code ?? cell.detected_source_code ?? "?";
}

export function targetForGroup(cell: Cell) {
  return cell.target_code ?? "?";
}

export function reviewGroupKey(cell: Cell) {
  return `${sourceForGroup(cell)}->${targetForGroup(cell)}`;
}

export function compareCodes(left: string, right: string) {
  return left.localeCompare(right, "zh-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

export function buildReviewGroups(cells: Cell[]): ReviewGroup[] {
  const groups = new Map<string, ReviewGroup>();
  for (const cell of cells) {
    const source = sourceForGroup(cell);
    const target = targetForGroup(cell);
    const reasons = [...cell.issue_reasons].sort();
    const key = reviewGroupKey(cell);
    const existing = groups.get(key);
    if (existing) {
      existing.cells.push(cell);
      existing.issueReasons = Array.from(
        new Set([...existing.issueReasons, ...reasons]),
      ).sort();
    } else {
      groups.set(key, {
        key,
        source,
        target,
        issueReasons: reasons,
        cells: [cell],
      });
    }
  }
  return Array.from(groups.values()).sort((left, right) => {
    if (right.cells.length !== left.cells.length) {
      return right.cells.length - left.cells.length;
    }
    return left.key.localeCompare(right.key);
  });
}
