from __future__ import annotations

import socket
import threading
import time
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser

import uvicorn

from bead_converter.main import app


def find_available_port(preferred_port: int = 8765) -> int:
    if _can_bind(preferred_port):
        return preferred_port
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def _can_bind(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def open_browser_when_ready(url: str, timeout_seconds: float = 20.0) -> None:
    deadline = time.monotonic() + timeout_seconds
    health_url = f"{url.rstrip('/')}/api/health"
    while time.monotonic() < deadline:
        try:
            with urlopen(health_url, timeout=1.0) as response:
                if response.status == 200:
                    webbrowser.open(url)
                    return
        except URLError:
            time.sleep(0.2)


def main() -> int:
    port = find_available_port()
    url = f"http://127.0.0.1:{port}/"
    print("Starting Perler Beads Blueprint Converter...", flush=True)
    print(f"If the browser does not open automatically, visit: {url}", flush=True)
    threading.Thread(
        target=open_browser_when_ready,
        args=(url,),
        daemon=True,
    ).start()
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
