from bead_converter.vision.color import delta_e, sample_cell_color
from fixtures.generate_patterns import make_colored_cell_with_dark_code


def test_sample_color_ignores_dark_text_and_border() -> None:
    cell = make_colored_cell_with_dark_code(fill=(244, 150, 160), code="F14")

    sampled = sample_cell_color(cell)

    assert abs(sampled.r - 244) < 8
    assert abs(sampled.g - 150) < 8
    assert abs(sampled.b - 160) < 8


def test_delta_e_orders_close_color_before_distant_color() -> None:
    close = delta_e((244, 150, 160), (246, 148, 159))
    far = delta_e((244, 150, 160), (20, 20, 20))

    assert close < far
