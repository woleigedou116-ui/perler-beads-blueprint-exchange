import cv2
import numpy as np
from PIL import Image

from bead_converter.domain.models import RGB

COLOR_MATCH_STRONG = 12.0
COLOR_MATCH_REVIEW = 25.0


def sample_cell_color(cell_image: Image.Image) -> RGB:
    width, height = cell_image.size
    inset_x = max(1, round(width * 0.15))
    inset_y = max(1, round(height * 0.15))
    interior = np.asarray(
        cell_image.convert("RGB").crop(
            (inset_x, inset_y, width - inset_x, height - inset_y)
        )
    )
    pixels = interior.reshape(-1, 3)
    brightness = pixels.mean(axis=1)
    threshold = np.percentile(brightness, 20)
    retained = pixels[brightness >= threshold]
    if retained.size == 0:
        retained = pixels
    red, green, blue = np.median(retained, axis=0).round().astype(int)
    return RGB(r=int(red), g=int(green), b=int(blue))


def delta_e(left: tuple[int, int, int], right: tuple[int, int, int]) -> float:
    pair = np.asarray([[left, right]], dtype=np.uint8)
    lab = cv2.cvtColor(pair, cv2.COLOR_RGB2LAB).astype(float)[0]
    return float(np.linalg.norm(lab[0] - lab[1]))
