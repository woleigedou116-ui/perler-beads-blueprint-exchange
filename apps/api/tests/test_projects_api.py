def test_upload_defaults_to_mard_and_returns_reviewable_project(
    client,
    synthetic_png: bytes,
) -> None:
    response = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
        data={"target_standard": "COCO"},
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["source_standard"] == "MARD"
    assert payload["target_standard"] == "COCO"
    assert payload["cells"][0]["target_code"] == "B09"


def test_upload_reports_import_timing_header(client, synthetic_png: bytes) -> None:
    response = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
        data={"target_standard": "COCO"},
    )

    assert response.status_code == 201
    timing = response.headers["X-Bead-Timing"]
    assert "total_ms=" in timing
    assert "read_ms=" in timing
    assert "recognize_ms=" in timing
    assert "ocr_ms=" in timing
    assert "ocr_reps=" in timing
    assert "ocr_engine_calls=" in timing
    assert "ocr_engine_max_ms=" in timing
    assert "save_ms=" in timing


def test_confirm_mapping_updates_matching_cells(client, synthetic_png: bytes) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    response = client.patch(
        f"/api/projects/{created['id']}/mappings/H7",
        json={"target_code": "B09"},
    )

    assert response.status_code == 200
    assert all(
        cell["target_code"] == "B09"
        for cell in response.json()["cells"]
        if cell["confirmed_source_code"] == "H7"
    )


def test_unsupported_conversion_is_rejected(client, synthetic_png: bytes) -> None:
    response = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
        data={"source_standard": "COCO", "target_standard": "MARD"},
    )

    assert response.status_code == 422


def test_saved_project_can_be_reopened(client, synthetic_png: bytes) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    response = client.get(f"/api/projects/{created['id']}")

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_correct_cell_records_user_edit(client, synthetic_png: bytes) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    response = client.patch(
        f"/api/projects/{created['id']}/cells/0/0",
        json={"source_code": "F14", "target_code": "K07"},
    )

    cell = response.json()["cells"][0]
    assert response.status_code == 200
    assert cell["confirmed_source_code"] == "F14"
    assert cell["target_code"] == "K07"
    assert "user-corrected" in cell["issue_reasons"]


def test_mark_single_cell_unwanted_clears_recognized_bead(
    client,
    synthetic_png: bytes,
) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    response = client.patch(
        f"/api/projects/{created['id']}/cells/unwanted",
        json={"row": 0, "column": 0},
    )

    cell = response.json()["cells"][0]
    assert response.status_code == 200
    assert cell["status"] == "empty"
    assert cell["detected_source_code"] is None
    assert cell["confirmed_source_code"] is None
    assert cell["target_code"] is None
    assert cell["confidence"] == 0
    assert cell["ocr_candidates"] == []
    assert "user-marked-unwanted" in cell["issue_reasons"]


def test_mark_cell_range_unwanted_clears_all_cells_in_rectangle(
    client,
    synthetic_png: bytes,
) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    response = client.patch(
        f"/api/projects/{created['id']}/cells/unwanted",
        json={
            "start_row": 0,
            "start_column": 0,
            "end_row": 1,
            "end_column": 1,
        },
    )

    assert response.status_code == 200
    cells = {
        (cell["row"], cell["column"]): cell
        for cell in response.json()["cells"]
        if cell["row"] in {0, 1} and cell["column"] in {0, 1}
    }
    assert set(cells) == {(0, 0), (0, 1), (1, 0), (1, 1)}
    assert all(cell["status"] == "empty" for cell in cells.values())
    assert all(cell["detected_source_code"] is None for cell in cells.values())
    assert all(cell["confirmed_source_code"] is None for cell in cells.values())
    assert all(cell["target_code"] is None for cell in cells.values())
    assert all(cell["confidence"] == 0 for cell in cells.values())
    assert all(cell["ocr_candidates"] == [] for cell in cells.values())
    assert all(
        "user-marked-unwanted" in cell["issue_reasons"]
        for cell in cells.values()
    )


def test_mark_unwanted_out_of_bounds_range_is_rejected(
    client,
    synthetic_png: bytes,
) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    response = client.patch(
        f"/api/projects/{created['id']}/cells/unwanted",
        json={
            "start_row": 0,
            "start_column": 0,
            "end_row": 3,
            "end_column": 1,
        },
    )

    assert response.status_code == 422


def test_unwanted_cells_are_preserved_when_project_is_reopened(
    client,
    synthetic_png: bytes,
) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()
    client.patch(
        f"/api/projects/{created['id']}/cells/unwanted",
        json={"row": 0, "column": 0},
    )

    response = client.get(f"/api/projects/{created['id']}")

    cell = response.json()["cells"][0]
    assert response.status_code == 200
    assert cell["status"] == "empty"
    assert cell["target_code"] is None
    assert cell["ocr_candidates"] == []
    assert "user-marked-unwanted" in cell["issue_reasons"]


def test_source_image_can_be_loaded_after_project_reopen(
    client,
    synthetic_png: bytes,
) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()
    archive = client.get(
        f"/api/projects/{created['id']}/exports/project.beadproject"
    ).content
    reopened = client.post(
        "/api/projects/open",
        files={
            "archive": (
                "project.beadproject",
                archive,
                "application/octet-stream",
            )
        },
    ).json()

    response = client.get(f"/api/projects/{reopened['id']}/source-image")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.content == synthetic_png


def test_source_attribution_can_be_saved(client, synthetic_png: bytes) -> None:
    created = client.post(
        "/api/projects/import",
        files={"image": ("pattern.png", synthetic_png, "image/png")},
    ).json()

    response = client.post(
        f"/api/projects/{created['id']}/source-attribution",
        json={"source_attribution": "原图作者：示例"},
    )

    assert response.status_code == 200
    assert response.json()["source_attribution"] == "原图作者：示例"


def test_palette_endpoint_exposes_verified_library(client) -> None:
    response = client.get("/api/palettes/mard-coco")

    assert response.status_code == 200
    assert response.json()["version"] == "mard-coco.v1"
    assert response.json()["mappings"]
