import json
from pathlib import Path


def main() -> None:
    path = Path("data/palettes/mard-coco.v1.json")
    payload = json.loads(path.read_text(encoding="utf-8"))
    rows = payload["mappings"]
    source_codes = [row["sourceCode"] for row in rows]

    assert len(source_codes) == len(set(source_codes)), "duplicate MARD code"
    assert all(row["verified"] for row in rows), "unreviewed mapping in v1"
    assert {"H2", "H7", "F14"}.issubset(source_codes), "required sample mappings missing"
    assert all(len(row["sourceRgb"]) == 3 for row in rows), "source RGB missing"
    assert all(len(row["targetRgb"]) == 3 for row in rows), "target RGB missing"
    print(f"validated {len(rows)} MARD -> COCO mappings")


if __name__ == "__main__":
    main()
