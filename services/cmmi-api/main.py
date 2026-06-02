"""
CMMI Models API — microservicio FastAPI.

Ejecuta los modelos PPB/PPM del área COMERCIAL (SPC Carta P + Random Forest v2)
sobre un Excel de oportunidades y devuelve resultados (JSON) + imágenes (base64).

Arranque:
    cd services/cmmi-api
    "C:/ProgramData/anaconda3/python.exe" -m uvicorn main:app --port 8008
"""

from __future__ import annotations
import io
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from prep import curate_comercial
from runner import execute, SCRIPTS_DIR, STORE_DIR

app = FastAPI(title="CMMI Models API", version="1.0.0")

# El proxy de Next llama server-side; CORS abierto para dev local.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

BUNDLED_PKL = SCRIPTS_DIR / "modelo_rf_v2.pkl"
STORED_PKL  = STORE_DIR / "modelo_rf_v2.pkl"


def _leer_excel(upload: UploadFile, curar: bool = True) -> tuple[pd.DataFrame, dict]:
    if not upload.filename or not upload.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Se requiere un archivo .xlsx/.xls")
    raw = upload.file.read()
    try:
        df = pd.read_excel(io.BytesIO(raw))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"No se pudo leer el Excel: {e}")
    if not curar:
        return df, {"registros_incluidos": len(df)}
    df_c, meta = curate_comercial(df)
    if len(df_c) == 0:
        raise HTTPException(422, "Tras la curación no quedaron registros válidos.")
    return df_c, meta


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "cmmi-models",
        "modelo_rf_entrenado": STORED_PKL.exists(),
        "pkl_bundled": BUNDLED_PKL.exists(),
    }


@app.post("/comercial/spc")
def comercial_spc(file: UploadFile = File(...)) -> dict:
    """SPC — Carta de Control P (v2 altA, Win Rate competitivo, base Fase 2)."""
    df, meta = _leer_excel(file)
    out = execute(
        "spc_baseline_altA.py", df,
        images={
            "carta_p":      "f2_carta_p.png",
            "nelson":       "f2_nelson.png",
            "estadisticos": "f2_estadisticos.png",
        },
        csvs={"baseline": "baseline_altA.csv", "signals": "signals_altA.csv"},
        jsons={"resumen": "stats_altA.json"},
    )
    if not out["ok"]:
        raise HTTPException(500, f"SPC falló: {out['stderr'][-1500:]}")
    out["curacion"] = meta
    return out


@app.post("/comercial/rf/train")
def comercial_rf_train(file: UploadFile = File(...)) -> dict:
    """Random Forest v2 — entrena, evalúa (5-fold CV) y persiste el modelo."""
    df, meta = _leer_excel(file)
    out = execute(
        "modelo_random_forest_v2.py", df,
        extra_args=["--modo", "entrenar"],
        images={
            "dashboard":    "rf_dashboard.png",
            "comercial":    "rf_comercial_analysis.png",
            "interactions": "rf_interactions.png",
        },
        csvs={"predictions": "predictions_v2.csv"},
        jsons={"metrics": "model_metrics_v2.json"},
        keep_outputs=["modelo_rf_v2.pkl"],
    )
    if not out["ok"]:
        raise HTTPException(500, f"Entrenamiento RF falló: {out['stderr'][-1500:]}")
    out["curacion"] = meta
    return out


@app.post("/comercial/rf/predict")
def comercial_rf_predict(file: UploadFile = File(...)) -> dict:
    """Predice prob_ganado sobre oportunidades nuevas usando el modelo persistido."""
    df, meta = _leer_excel(file, curar=False)
    pkl = STORED_PKL if STORED_PKL.exists() else BUNDLED_PKL
    if not pkl.exists():
        raise HTTPException(409, "No hay modelo disponible. Entrena primero con /comercial/rf/train.")
    out = execute(
        "modelo_random_forest_v2.py", df,
        extra_args=["--modo", "predecir", "--nuevos", "Oportunidades.xlsx",
                    "--modelo", pkl.name],
        csvs={"predictions": "predictions_v2.csv"},
        extra_inputs=[pkl],
        csv_limit=1000,
    )
    if not out["ok"]:
        raise HTTPException(500, f"Predicción RF falló: {out['stderr'][-1500:]}")
    out["modelo_usado"] = "entrenado" if pkl == STORED_PKL else "bundled"
    out["registros"] = meta.get("registros_incluidos")
    return out
