"""
proyectos.py — inferencia directa sobre los 4 modelos de Proyectos.
Carga los .pkl una vez al importar y expone funciones puras sin subprocess.
"""
from __future__ import annotations

import json
import pickle
import warnings
from pathlib import Path
from typing import Any

import numpy as np

warnings.filterwarnings("ignore")

PROJ_DIR = Path(__file__).parent / "scripts" / "proyectos"

# ── Carga en frío ──────────────────────────────────────────────────────
def _pkl(name: str) -> Any | None:
    p = PROJ_DIR / name
    if not p.exists():
        return None
    with open(p, "rb") as f:
        return pickle.load(f)

_kickoff  = _pkl("modelo_kickoff_params.pkl")
_modelo_a = _pkl("modeloA_params.pkl")
_modelo1  = _pkl("modelo1_params.pkl")
_modelo2  = _pkl("modelo2_params.pkl")

_lb_spi: dict | None = None
_lb_path = PROJ_DIR / "lineas_base_SPI.json"
if _lb_path.exists():
    _lb_spi = json.loads(_lb_path.read_text(encoding="utf-8"))

PORTAFOLIOS_VALIDOS = list(
    (_kickoff or {}).get("port_map", {}).keys()
) or ["TI", "DATOS Y SISTEMAS DE INFORMACIÓN", "CONSULTORÍA"]


# ── Helpers de construcción de vectores ───────────────────────────────
def _enc_port(art: dict, portafolio: str) -> tuple[int, bool]:
    enc = art["port_map"].get(portafolio)
    nuevo = enc is None
    if nuevo:
        enc = 0
    return int(enc), nuevo


def _enc_lider(art: dict, lider: str) -> tuple[int, bool]:
    enc = art["lider_map"].get(lider)
    nuevo = enc is None
    if nuevo:
        enc = int(np.median(list(art["lider_map"].values())))
    return int(enc), nuevo


def _vector_kickoff(art: dict, portafolio: str, lider: str,
                    duracion_meses: float, presupuesto: float | None) -> np.ndarray:
    port_enc,  _ = _enc_port(art, portafolio)
    lider_enc, _ = _enc_lider(art, lider)
    if presupuesto is None:
        presupuesto = art["presupuesto_median"]
    return np.array([[
        port_enc, lider_enc, float(duracion_meses),
        float(np.log1p(presupuesto)),
        1 if duracion_meses <= 3 else 0,
        1 if 3 < duracion_meses <= 12 else 0,
        1 if duracion_meses > 12 else 0,
    ]])


def _vector_m12(art: dict, portafolio: str, lider: str,
                mes_rel: float, spi_lag1: float, vra_lag1: float,
                spi_lag2: float | None, spi_trend: float | None,
                vra_trend: float | None) -> np.ndarray:
    port_enc,  _ = _enc_port(art, portafolio)
    lider_enc, _ = _enc_lider(art, lider)
    if spi_lag2 is None:
        spi_lag2 = spi_lag1
    if spi_trend is None:
        spi_trend = spi_lag1 - spi_lag2
    if vra_trend is None:
        vra_trend = 0.0
    return np.array([[
        mes_rel, spi_lag1, vra_lag1,
        spi_lag2, spi_trend, vra_trend,
        port_enc, lider_enc,
    ]])


# ── Lookup tasa histórica (kickoff y modelo A) ────────────────────────
def _lookup(art: dict, portafolio: str, duracion_meses: float,
            tasa_key: str) -> tuple[float | None, int]:
    cat = ("corto (<=3m)" if duracion_meses <= 3
           else "mediano (3-12m)" if duracion_meses <= 12
           else "largo (>12m)")
    for row in art.get("lookup", []):
        if str(row.get("portafolio")) == portafolio and str(row.get("dur_cat")) == cat:
            t = row.get(tasa_key)
            n = int(row.get("n_total", 0))
            return (float(t) if t is not None else None), n
    return None, 0


def _vs_hist(prob: float, tasa: float | None, n: int) -> str:
    if tasa is None or n < 3:
        return f"segmento con muestra pequeña (n={n}) — usar con cautela"
    diff = prob - tasa
    ref = f"tasa histórica {tasa:.0%}, n={n}"
    if diff > 0.10:
        return f"superior a la {ref}"
    if diff < -0.10:
        return f"inferior a la {ref}"
    return f"similar a la {ref}"


# ── Semáforos ─────────────────────────────────────────────────────────
def _semaforo_kickoff(prob: float, umbral: float) -> tuple[str, str]:
    if prob >= 0.50:
        return "ROJO", "ALTO"
    if prob >= umbral:
        return "AMARILLO", "MODERADO"
    return "VERDE", "BAJO"


def _semaforo_a(prob: float, umbral: float) -> tuple[str, str]:
    if prob >= umbral:
        return "ROJO", "ALTO"
    if prob >= 0.25:
        return "AMARILLO", "MODERADO"
    return "VERDE", "BAJO"


def _semaforo_m1(prob: float, umbral: float) -> tuple[str, str]:
    if prob >= umbral:
        return "ROJO", "ALERTA"
    if prob >= 0.20:
        return "AMARILLO", "VIGILAR"
    return "VERDE", "OK"


def _semaforo_m2(prob: float, umbral: float) -> tuple[str, str]:
    if prob >= umbral:
        return "ROJO", "ALTO"
    if prob >= 0.25:
        return "AMARILLO", "MODERADO"
    return "VERDE", "BAJO"


# ── Endpoint: kickoff ─────────────────────────────────────────────────
def predecir_kickoff(portafolio: str, lider: str,
                     duracion_meses: float, presupuesto: float | None) -> dict:
    avisos: list[str] = []

    if _kickoff is None or _modelo_a is None:
        raise RuntimeError("Modelos de kickoff no disponibles.")

    # Lider nuevo check
    if lider not in _kickoff["lider_map"]:
        avisos.append(f"Líder '{lider}' no está en el historial — se usa el código promedio.")

    # Modelo Kickoff
    X_k  = _vector_kickoff(_kickoff, portafolio, lider, duracion_meses, presupuesto)
    p_k  = float(_kickoff["modelo"].predict_proba(X_k)[0][1])
    u_k  = _kickoff["metricas"]["umbral_alerta"]
    sem_k, niv_k = _semaforo_kickoff(p_k, u_k)
    tasa_k, n_k  = _lookup(_kickoff, portafolio, duracion_meses, "tasa_riesgo")

    # Modelo A
    X_a  = _vector_kickoff(_modelo_a, portafolio, lider, duracion_meses, presupuesto)
    p_a  = float(_modelo_a["modelo"].predict_proba(X_a)[0][1])
    u_a  = _modelo_a["metricas"]["umbral_alerta"]
    sem_a, niv_a = _semaforo_a(p_a, u_a)
    tasa_a, n_a  = _lookup(_modelo_a, portafolio, duracion_meses, "tasa_no_completado")

    # Perfil combinado
    perfil = _perfil_combinado(niv_k, niv_a)

    return {
        "portafolio":     portafolio,
        "lider":          lider,
        "duracion_meses": duracion_meses,
        "presupuesto":    presupuesto,
        "avisos":         avisos,
        "kickoff": {
            "probabilidad":     round(p_k, 4),
            "probabilidad_pct": f"{p_k:.1%}",
            "semaforo":         sem_k,
            "nivel":            niv_k,
            "vs_historico":     _vs_hist(p_k, tasa_k, n_k),
            "auc":              _kickoff["metricas"]["auc"],
            "confianza":        "BAJA (AUC 0.56) — reemplazar con Modelo 2 al primer reporte",
        },
        "modelo_a": {
            "probabilidad":     round(p_a, 4),
            "probabilidad_pct": f"{p_a:.1%}",
            "semaforo":         sem_a,
            "nivel":            niv_a,
            "vs_historico":     _vs_hist(p_a, tasa_a, n_a),
            "auc":              _modelo_a["metricas"]["auc"],
        },
        "perfil_combinado": perfil,
    }


def _perfil_combinado(niv_k: str, niv_a: str) -> dict:
    alto_k = niv_k == "ALTO"
    alto_a = niv_a == "ALTO"
    if alto_k and alto_a:
        return {"semaforo": "ROJO",     "descripcion": "Riesgo máximo — cronograma y alcance comprometidos. Activar protocolo de intervención."}
    if alto_k:
        return {"semaforo": "AMARILLO", "descripcion": "Riesgo de cronograma. Alcance aparentemente protegido. Reforzar seguimiento de SPI."}
    if alto_a:
        return {"semaforo": "AMARILLO", "descripcion": "Riesgo de alcance sin señal de cronograma. Revisar scope y recursos antes del kickoff."}
    return {"semaforo": "VERDE",     "descripcion": "Perfil de bajo riesgo global. Seguimiento estándar."}


# ── Endpoint: seguimiento (Modelo 1 + Modelo 2 + Línea Base SPI) ──────
def predecir_seguimiento(portafolio: str, lider: str, mes_rel: float,
                         spi_lag1: float, vra_lag1: float,
                         spi_lag2: float | None, spi_observado: float | None) -> dict:
    avisos: list[str] = []

    if _modelo1 is None or _modelo2 is None:
        raise RuntimeError("Modelos de seguimiento no disponibles.")

    if lider not in _modelo1["lider_map"]:
        avisos.append(f"Líder '{lider}' no está en el historial — se usa el código promedio.")
    if mes_rel > 0.35 and _modelo2 is not None:
        avisos.append("Modelo 2 está optimizado para mes_rel ≤ 0.30. Para fases avanzadas el Modelo 1 es más preciso.")

    # Modelo 1
    X1   = _vector_m12(_modelo1, portafolio, lider, mes_rel, spi_lag1, vra_lag1, spi_lag2, None, None)
    p1   = float(_modelo1["modelo"].predict_proba(X1)[0][1])
    u1   = _modelo1["metricas"]["umbral_alerta"]
    sem1, est1 = _semaforo_m1(p1, u1)

    # Modelo 2
    X2   = _vector_m12(_modelo2, portafolio, lider, mes_rel, spi_lag1, vra_lag1, spi_lag2, None, None)
    p2   = float(_modelo2["modelo"].predict_proba(X2)[0][1])
    u2   = _modelo2["metricas"]["umbral_alerta"]
    sem2, niv2 = _semaforo_m2(p2, u2)

    # Línea base SPI
    lb = None
    if spi_observado is not None and _lb_spi is not None:
        lb = _consultar_lb(portafolio, mes_rel, spi_observado)

    return {
        "portafolio": portafolio,
        "lider":      lider,
        "mes_rel":    mes_rel,
        "avisos":     avisos,
        "modelo1": {
            "probabilidad":     round(p1, 4),
            "probabilidad_pct": f"{p1:.1%}",
            "semaforo":         sem1,
            "estado":           est1,
            "auc":              _modelo1["metricas"]["auc"],
        },
        "modelo2": {
            "probabilidad":     round(p2, 4),
            "probabilidad_pct": f"{p2:.1%}",
            "semaforo":         sem2,
            "nivel":            niv2,
            "auc":              _modelo2["metricas"]["auc"],
        },
        "linea_base_spi": lb,
    }


def _consultar_lb(portafolio: str, mes_rel: float, spi: float) -> dict:
    lb = _lb_spi
    idx   = min(int(mes_rel * 10), 9)
    bin_l = f"{idx*10}-{(idx+1)*10}%"

    ports = lb.get("por_portafolio", {})
    if portafolio in ports:
        fase  = ports[portafolio]["por_fase"].get(bin_l, {})
        gbl   = ports[portafolio]["global"]
        fuente = portafolio
    else:
        fase  = lb["global"]["por_fase"].get(bin_l, {})
        gbl   = lb["global"]["global"]
        fuente = "GLOBAL"

    cl  = fase.get("CL")
    ucl = fase.get("UCL")
    lcl = fase.get("LCL")
    n   = fase.get("n", 0)

    # fallback a global si muestra insuficiente
    if cl is None or n < 3:
        fase_g = lb["global"]["por_fase"].get(bin_l, {})
        cl, ucl, lcl = fase_g.get("CL"), fase_g.get("UCL"), fase_g.get("LCL")
        fuente += " (muestra insuficiente — usando global)"

    if ucl is not None and spi > ucl:
        sem, estado = "AMARILLO", "SOBRE LÍMITE SUPERIOR"
    elif lcl is not None and spi < lcl:
        sem, estado = "ROJO",     "BAJO LÍMITE INFERIOR"
    elif cl is not None and spi < cl:
        sem, estado = "AMARILLO", "POR DEBAJO DE LA MEDIA"
    else:
        sem, estado = "VERDE",    "DENTRO DEL RANGO ESPERADO"

    std  = fase.get("std")
    sigmas = round((spi - cl) / std, 2) if (cl is not None and std and std > 0) else None

    return {
        "fase":            bin_l,
        "fuente":          fuente,
        "SPI_observado":   round(spi, 4),
        "CL":              round(cl,  4) if cl  is not None else None,
        "UCL":             round(ucl, 4) if ucl is not None else None,
        "LCL":             round(lcl, 4) if lcl is not None else None,
        "n":               n,
        "sigmas_desde_CL": sigmas,
        "semaforo":        sem,
        "estado":          estado,
    }


# ── Health info ───────────────────────────────────────────────────────
def status() -> dict:
    return {
        "modelo_kickoff":  _kickoff is not None,
        "modelo_a":        _modelo_a is not None,
        "modelo1":         _modelo1 is not None,
        "modelo2":         _modelo2 is not None,
        "linea_base_spi":  _lb_spi is not None,
        "portafolios":     PORTAFOLIOS_VALIDOS,
    }
