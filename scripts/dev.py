import subprocess
import sys


if __name__ == "__main__":
    raise SystemExit(
        subprocess.call(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "bead_converter.main:app",
                "--reload",
                "--port",
                "8765",
            ],
            cwd="apps/api",
        )
    )
