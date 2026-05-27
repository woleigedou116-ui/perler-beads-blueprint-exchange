import csv
from collections import Counter
from io import StringIO

from bead_converter.domain.models import BeadProject, CellStatus


def export_mapping_csv(project: BeadProject) -> bytes:
    counts: Counter[tuple[str, str, str]] = Counter()
    for cell in project.cells:
        if cell.status == CellStatus.empty:
            continue
        source_code = cell.confirmed_source_code or cell.detected_source_code or ""
        target_code = cell.target_code or ""
        counts[(source_code, target_code, cell.status.value)] += 1

    output = StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["来源色号", "目标色号", "数量", "确认状态"])
    for (source_code, target_code, status), count in sorted(counts.items()):
        writer.writerow([source_code, target_code, count, status])
    return output.getvalue().encode("utf-8-sig")
