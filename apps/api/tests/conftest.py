from io import BytesIO

import pytest
from fastapi.testclient import TestClient

from bead_converter.domain.models import OcrCandidate
from bead_converter.main import create_app
from fixtures.generate_patterns import make_grid_with_cell_fill


class TestOcr:
    def recognize_cells(self, cell_images, known_codes):
        results = [[] for _cell in cell_images]
        if results:
            results[0] = [
                OcrCandidate(text="H7", normalized_code="H7", confidence=0.99)
            ]
        return results


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(data_root=tmp_path, ocr_provider=TestOcr()))


@pytest.fixture
def synthetic_png() -> bytes:
    output = BytesIO()
    make_grid_with_cell_fill((14, 14, 14)).save(output, format="PNG")
    return output.getvalue()
