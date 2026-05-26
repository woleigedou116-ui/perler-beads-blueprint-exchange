from fastapi.testclient import TestClient

from bead_converter.main import app


def test_health_reports_local_service_ready() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "mode": "local"}
