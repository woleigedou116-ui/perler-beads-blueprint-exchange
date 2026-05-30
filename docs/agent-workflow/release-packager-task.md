# Release Packager Task

Use this task card when a release/package build would pollute the main coding
conversation with long PyInstaller, zip, and verification logs.

## Role

You are the release packager for the current feature branch. Do not change
product behavior unless the packaging process is blocked and the main agent has
explicitly approved the fix.

## Inputs From Main Agent

- Version, for example `0.1.0-beta.3`.
- Package target, currently `windows-portable`.
- Worktree path, normally:
  `D:\vibecoding_project\perlerbeads_blueprint_exchange\.worktrees\feature-mard-coco-mvp`

## Required Steps

1. Confirm the worktree is clean before packaging:

   ```powershell
   git status --short --branch
   ```

2. Build and verify:

   ```powershell
   .\.venv\Scripts\python.exe -m pytest
   cd apps\web
   npm test -- --run
   npm run build
   cd ..\..
   .\.venv\Scripts\pyinstaller.exe scripts\perler_beads_desktop.spec --noconfirm --clean
   ```

3. Copy the user-facing README into the portable folder. For a new version,
   create or update the matching file under `docs/releases/` first:

   ```powershell
   Copy-Item -LiteralPath docs\releases\README-<version>.txt -Destination "dist\拼豆图纸转换工具\README-请先看我.txt" -Force
   ```

4. Smoke-test the exe:

   - Start `dist\拼豆图纸转换工具\拼豆图纸转换工具.exe`.
   - Confirm `/api/health` returns `{"status":"ok","mode":"local"}`.
   - Confirm `/` returns HTTP 200 and includes `拼豆图纸标准转换`.
   - Upload a small PNG through `POST /api/projects/import` with
     `image/png`; confirm HTTP 201.
   - Stop the exe process.

5. Create the release zip:

   ```powershell
   Compress-Archive -LiteralPath "dist\拼豆图纸转换工具" -DestinationPath "release\perler-beads-blueprint-exchange-<version>-windows-portable.zip" -Force
   ```

6. Inspect the zip contents:

   - Must include `拼豆图纸转换工具.exe`.
   - Must include `README-请先看我.txt`.
   - Must include `_internal/apps/web/dist/index.html`.
   - Must include `_internal/data/palettes/mard-coco.v1.json`.
   - Must include RapidOCR `.onnx` model files.
   - Must not include `.data`, `.venv`, `node_modules`, sample image folders,
     caches, or `__pycache__`.

7. Compute SHA256:

   ```powershell
   Get-FileHash -Algorithm SHA256 -LiteralPath "release\perler-beads-blueprint-exchange-<version>-windows-portable.zip"
   ```

## Output Back To Main Agent

Report only:

- Commit/tag packaged.
- Zip path.
- Zip size.
- SHA256.
- Verification commands and pass/fail result.
- Any PyInstaller warnings that may affect runtime. Ignore optional backend
  warnings already known to be harmless, such as missing TensorRT.
- Whether the worktree remained clean.

Do not paste full build logs unless a command failed.
