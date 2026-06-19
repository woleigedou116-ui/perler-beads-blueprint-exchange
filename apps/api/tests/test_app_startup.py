from pathlib import Path

from fastapi.testclient import TestClient

from bead_converter.main import create_app


class FakeOcr:
    def recognize_cells(self, cell_images, known_codes):
        return [[] for _cell in cell_images]


def test_injected_ocr_provider_disables_startup_prewarm(
    monkeypatch,
    tmp_path: Path,
) -> None:
    calls = []

    def fake_provider():
        calls.append("created")
        return FakeOcr()

    monkeypatch.setattr("bead_converter.main.RapidOcrProvider", fake_provider)

    app = create_app(data_root=tmp_path, ocr_provider=FakeOcr())
    with TestClient(app):
        pass

    assert calls == []


def test_startup_prewarms_ocr_when_provider_is_not_injected(
    monkeypatch,
    tmp_path: Path,
) -> None:
    created = FakeOcr()
    calls = []

    def fake_provider():
        calls.append("created")
        return created

    class ImmediateThread:
        def __init__(self, target, daemon):
            self._target = target
            self.daemon = daemon

        def start(self):
            self._target()

    monkeypatch.setattr("bead_converter.main.RapidOcrProvider", fake_provider)
    monkeypatch.setattr("bead_converter.main.Thread", ImmediateThread)

    app = create_app(data_root=tmp_path)
    with TestClient(app):
        pass

    assert calls == ["created"]
    assert app.state.ocr is created
