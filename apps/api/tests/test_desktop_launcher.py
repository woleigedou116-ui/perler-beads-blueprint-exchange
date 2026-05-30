import socket

from bead_converter.desktop_launcher import find_available_port


def test_find_available_port_skips_busy_port() -> None:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
        server.bind(("127.0.0.1", 0))
        server.listen()
        busy_port = server.getsockname()[1]

        selected = find_available_port(preferred_port=busy_port)

    assert selected != busy_port
    assert selected > 0
