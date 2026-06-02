"""
Orquestación: ejecuta los scripts de modelos TAL CUAL (subprocess) en una
carpeta temporal y recolecta sus salidas (PNG / CSV / JSON / stdout).
"""

from __future__ import annotations
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pandas as pd

BASE_DIR    = Path(__file__).parent
SCRIPTS_DIR = BASE_DIR / "scripts" / "comercial"
STORE_DIR   = BASE_DIR / "store"
STORE_DIR.mkdir(exist_ok=True)

INPUT_NAME = "Oportunidades.xlsx"
TIMEOUT_S  = 600


def _img_b64(p: Path) -> str | None:
    return base64.b64encode(p.read_bytes()).decode("ascii") if p.exists() else None


def _csv_records(p: Path, limit: int | None = None) -> list | None:
    if not p.exists():
        return None
    df = pd.read_csv(p)
    if limit is not None:
        df = df.head(limit)
    # NaN → None para JSON válido
    return df.where(pd.notna(df), None).to_dict(orient="records")


def _csv_count(p: Path) -> int:
    if not p.exists():
        return 0
    return len(pd.read_csv(p))


def _json(p: Path) -> dict | None:
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def execute(
    script: str,
    df_input: pd.DataFrame,
    extra_args: list[str] | None = None,
    images: dict[str, str] | None = None,    # clave_lógica -> nombre_archivo.png
    csvs: dict[str, str] | None = None,      # clave_lógica -> nombre_archivo.csv
    jsons: dict[str, str] | None = None,     # clave_lógica -> nombre_archivo.json
    csv_limit: int = 300,
    extra_inputs: list[Path] | None = None,  # archivos a copiar al tempdir (ej. .pkl)
    keep_outputs: list[str] | None = None,   # archivos a persistir en store/ (ej. pkl)
) -> dict:
    images = images or {}
    csvs = csvs or {}
    jsons = jsons or {}

    with tempfile.TemporaryDirectory(prefix="cmmi_") as td:
        tdp = Path(td)
        shutil.copy(SCRIPTS_DIR / script, tdp / script)

        for f in (extra_inputs or []):
            if f and Path(f).exists():
                shutil.copy(f, tdp / Path(f).name)

        # Escribir dataset de entrada (mantiene tipos fecha)
        df_input.to_excel(tdp / INPUT_NAME, index=False)

        cmd = [sys.executable, script, "--input", INPUT_NAME, *(extra_args or [])]
        env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
        proc = subprocess.run(
            cmd, cwd=td, capture_output=True, text=True,
            timeout=TIMEOUT_S, encoding="utf-8", errors="replace", env=env,
        )

        ok = proc.returncode == 0
        result: dict = {
            "ok": ok,
            "returncode": proc.returncode,
            "stdout": proc.stdout or "",
            "stderr": proc.stderr or "",
            "images": {k: _img_b64(tdp / v) for k, v in images.items()},
            "tables": {k: _csv_records(tdp / v, csv_limit) for k, v in csvs.items()},
            "table_counts": {k: _csv_count(tdp / v) for k, v in csvs.items()},
            "stats": {k: _json(tdp / v) for k, v in jsons.items()},
        }

        # Persistir artefactos (modelo entrenado, etc.)
        for name in (keep_outputs or []):
            src = tdp / name
            if src.exists():
                shutil.copy(src, STORE_DIR / name)

        return result
