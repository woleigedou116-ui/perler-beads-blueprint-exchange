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
