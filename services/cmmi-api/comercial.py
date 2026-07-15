"""
comercial.py — Predicción individual de oportunidades comerciales.

Carga el PKL del modelo RF v2 y expone predict_one() para evaluar
una sola oportunidad sin necesidad de subir un Excel completo.
"""
from __future__ import annotations

import pickle
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")

_SCRIPTS_DIR = Path(__file__).parent / "scripts" / "comercial"
_STORE_DIR   = Path(__file__).parent / "store"

_PKL_BUNDLED = _SCRIPTS_DIR / "modelo_rf_v2.pkl"
_PKL_STORED  = _STORE_DIR   / "modelo_rf_v2.pkl"

_art: dict | None = None


def _load() -> None:
    global _art
    pkl = _PKL_STORED if _PKL_STORED.exists() else _PKL_BUNDLED
    if not pkl.exists():
        return
    with open(pkl, "rb") as f:
        _art = pickle.load(f)


_load()


def _reload_if_newer() -> None:
    """Recarga el PKL si el stored es más reciente que el cargado en memoria."""
    pkl = _PKL_STORED if _PKL_STORED.exists() else _PKL_BUNDLED
    if not pkl.exists():
        return
    global _art
    if _art is None:
        _load()


def status() -> dict:
    _reload_if_newer()
    if _art is None:
        return {"disponible": False}
    enc = _art.get("encoders", {})
    return {
        "disponible":    True,
        "comerciales":   list(enc.get("Comercial", {}).classes_ if hasattr(enc.get("Comercial"), "classes_") else []),
        "lineas":        [c for c in (enc.get("Linea de Negocio", {}).classes_ if hasattr(enc.get("Linea de Negocio"), "classes_") else []) if isinstance(c, str)],
        "tipos_venta":   list(enc.get("Tipo de Venta", {}).classes_ if hasattr(enc.get("Tipo de Venta"), "classes_") else []),
        "segmentos":     list(enc.get("Segmento", {}).classes_ if hasattr(enc.get("Segmento"), "classes_") else []),
        "auc_cv":        round(_art["metrics"]["auc_cv"], 4) if "metrics" in _art else None,
    }


def predict_one(
    comercial:      str,
    linea:          str,
    tipo_venta:     str,
    segmento:       str,
    ingreso_cop:    float,
) -> dict:
    """Predice la probabilidad de ganar una oportunidad individual."""
    _reload_if_newer()
    if _art is None:
        raise RuntimeError("Modelo RF no disponible. Entrena primero desde la pestaña Comercial.")

    enc  = _art["encoders"]
    avisos: list[str] = []

    def _encode(col: str, val: str) -> int:
        le = enc.get(col)
        if le is None:
            return 0
        if val not in le.classes_:
            avisos.append(f"'{val}' no está en el historial de {col} — se usará el código 0.")
            return 0
        return int(le.transform([val])[0])

    x = np.array([[
        _encode("Comercial",       comercial),
        _encode("Linea de Negocio", linea),
        _encode("Tipo de Venta",    tipo_venta),
        _encode("Segmento",         segmento),
        float(np.log1p(ingreso_cop)),
    ]])

    modelo = _art["modelo"]
    prob   = float(modelo.predict_proba(x)[0][1])

    umbral = 0.50
    if prob >= 0.70:
        semaforo, nivel = "VERDE",    "ALTA"
    elif prob >= umbral:
        semaforo, nivel = "AMARILLO", "MODERADA"
    else:
        semaforo, nivel = "ROJO",     "BAJA"

    return {
        "probabilidad":     round(prob, 4),
        "probabilidad_pct": f"{prob:.1%}",
        "semaforo":         semaforo,
        "nivel":            nivel,
        "avisos":           avisos,
        "inputs": {
            "comercial":   comercial,
            "linea":       linea,
            "tipo_venta":  tipo_venta,
            "segmento":    segmento,
            "ingreso_cop": ingreso_cop,
        },
        "modelo": {
            "auc_cv":  round(_art["metrics"]["auc_cv"],  4),
            "acc_cv":  round(_art["metrics"]["acc_cv"],  4),
            "n_total": _art["metrics"]["n_total"],
        },
    }
