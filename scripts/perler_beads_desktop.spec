# -*- mode: python ; coding: utf-8 -*-

from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


ROOT = Path(SPECPATH).parent

datas = [
    (str(ROOT / "apps" / "web" / "dist"), "apps/web/dist"),
    (str(ROOT / "data" / "palettes"), "data/palettes"),
]
datas += collect_data_files("rapidocr", includes=["**/*.onnx", "**/*.yaml", "**/*.yml"])

hiddenimports = []
hiddenimports += collect_submodules("rapidocr")
hiddenimports += [
    "onnxruntime",
    "onnxruntime.capi._pybind_state",
    "onnxruntime.capi.onnxruntime_pybind11_state",
    "onnxruntime.capi.onnxruntime_inference_collection",
]


a = Analysis(
    [str(ROOT / "apps" / "api" / "src" / "bead_converter" / "desktop_launcher.py")],
    pathex=[str(ROOT / "apps" / "api" / "src")],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "onnx",
        "onnxruntime.quantization",
        "onnxruntime.tools",
        "onnxruntime.transformers",
        "tensorflow",
        "torch",
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="拼豆图纸转换工具",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="拼豆图纸转换工具",
)
