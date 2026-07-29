"""
cpi.py — Líneas base CPI + Predictor de riesgo de costo (Proyectos 2).

Carga lineas_base.json y modelo_CPI_params.pkl al importar.
Expone funciones puras para la API FastAPI.
"""
from __future__ import annotations

import json
import pickle
import warnings
from pathlib import Path

import numpy as np

warnings.filterwarnings("ignore")

PROJ_DIR = Path(__file__).parent / "scripts" / "proyectos"

CPI_CAP         = 5.0
CPI_THRESHOLD   = 0.80
ALERT_THRESHOLD = 0.35
BIN_LABELS      = [f"{i*10}-{(i+1)*10}%" for i in range(10)]

# ── Carga en frío ──────────────────────────────────────────────────────
_lb: dict | None = None
_lb_path = PROJ_DIR / "lineas_base_cpi.json"
if _lb_path.exists():
    _lb = json.loads(_lb_path.read_text(encoding="utf-8"))

_modelo: dict | None = None
_modelo_path = PROJ_DIR / "modelo_CPI_params.pkl"
if _modelo_path.exists():
    with open(_modelo_path, "rb") as f:
        _modelo = pickle.load(f)


# ── Helpers ────────────────────────────────────────────────────────────
def _get_bin(mes_rel: float) -> str:
    idx = min(int(mes_rel * 10), 9)
    return BIN_LABELS[idx]


def _diagnostico_indicador(lb: dict, portafolio: str, bin_lbl: str,
                            ind_key: str, valor: float) -> dict:
    CAP_MAP    = {"CPI": CPI_CAP, "SPI": None, "VA": None}
    LCL_MIN    = {"SPI": 0.0, "CPI": None, "VA": None}
    cap        = CAP_MAP.get(ind_key)
    lcl_min    = LCL_MIN.get(ind_key)
    v_cap      = min(valor, cap) if cap else valor

    ports = list(lb.get("por_portafolio", {}).keys())
    if portafolio in lb.get("por_portafolio", {}):
        seg    = lb["por_portafolio"][portafolio][ind_key]["por_fase"].get(bin_lbl, {})
        fuente = portafolio
    else:
        seg    = lb["global"][ind_key]["por_fase"].get(bin_lbl, {})
        fuente = "GLOBAL"

    seg_g = lb["global"][ind_key]["por_fase"].get(bin_lbl, {})
    n     = seg.get("n", 0) if seg else 0

    if n < 3:
        cl  = seg_g.get("CL"); ucl = seg_g.get("UCL")
        lcl = seg_g.get("LCL"); std = seg_g.get("std")
        nota_n = f"Muestra insuficiente (n={n}). Usando límites globales."
    else:
        cl  = seg.get("CL"); ucl = seg.get("UCL")
        lcl = seg.get("LCL"); std = seg.get("std")
        nota_n = None

    if lcl is not None and lcl_min is not None:
        lcl = max(lcl_min, lcl)

    if cl is None:
        semaforo, estado = "GRIS", "SIN DATOS"
        accion  = "Sin datos históricos suficientes."
        sigmas  = None
    elif v_cap > ucl:
        semaforo, estado = "AMARILLO", "SOBRE LÍMITE SUPERIOR"
        accion  = f"{ind_key} inusualmente alto. Verificar si el plan subestima el costo/avance real."
        sigmas  = round((v_cap - cl) / std, 2) if std and std > 0 else None
    elif v_cap < lcl:
        semaforo, estado = "ROJO", "BAJO LÍMITE INFERIOR"
        accion  = f"{ind_key} bajo el límite histórico. Causa especial detectada. Activar plan de recuperación."
        sigmas  = round((v_cap - cl) / std, 2) if std and std > 0 else None
    elif v_cap < cl:
        semaforo, estado = "AMARILLO", "POR DEBAJO DE LA MEDIA"
        accion  = f"{ind_key} por debajo de la media histórica pero dentro de límites. Monitoreo reforzado."
        sigmas  = round((v_cap - cl) / std, 2) if std and std > 0 else None
    else:
        semaforo, estado = "VERDE", "DENTRO DEL RANGO ESPERADO"
        accion  = f"{ind_key} dentro del rango esperado para este portafolio y fase."
        sigmas  = round((v_cap - cl) / std, 2) if std and std > 0 else None

    return {
        "indicador": ind_key, "valor_original": round(valor, 4),
        "valor_usado": round(v_cap, 4), "cap_aplicado": (cap is not None and valor > cap),
        "fuente": fuente, "fase": bin_lbl, "n_segmento": n,
        "CL": round(cl, 4) if cl is not None else None,
        "UCL": round(ucl, 4) if ucl is not None else None,
        "LCL": round(lcl, 4) if lcl is not None else None,
        "std": round(std, 4) if std is not None else None,
        "sigmas_CL": sigmas, "semaforo": semaforo, "estado": estado,
        "accion": accion, "nota_muestra": nota_n,
    }


# ── API pública ────────────────────────────────────────────────────────
def lineas_base_cpi() -> dict:
    if _lb is None:
        raise RuntimeError("Líneas base CPI no disponibles.")
    return _lb


def diagnostico(portafolio: str, mes_rel: float,
                spi: float, cpi: float, va: float,
                proyecto_id: str = "N/A") -> dict:
    if _lb is None:
        raise RuntimeError("Líneas base CPI no disponibles.")
    bin_lbl = _get_bin(mes_rel)
    ind = {}
    for k, val in [("SPI", spi), ("CPI", cpi), ("VA", va)]:
        ind[k] = _diagnostico_indicador(_lb, portafolio, bin_lbl, k, val)
    sems = [d["semaforo"] for d in ind.values()]
    if "ROJO" in sems:
        sg, eg = "ROJO", "ALERTA — indicador bajo límite inferior"
    elif sems.count("AMARILLO") >= 2:
        sg, eg = "AMARILLO", "VIGILAR — múltiples indicadores con señales"
    elif "AMARILLO" in sems:
        sg, eg = "AMARILLO", "VIGILAR — un indicador con señal de alerta"
    else:
        sg, eg = "VERDE", "OK — todos los indicadores dentro del rango esperado"
    return {
        "proyecto_id": proyecto_id, "portafolio": portafolio,
        "mes_rel": round(mes_rel, 4), "fase": bin_lbl,
        "semaforo_gral": sg, "estado_gral": eg, "indicadores": ind,
    }


def predecir_cpi(portafolio: str, lider: str, duracion_meses: float,
                 presupuesto: float | None,
                 cpi_m1: float, spi_m1: float, va_m1: float) -> dict:
    if _modelo is None:
        raise RuntimeError("Modelo CPI no disponible.")

    arte       = _modelo
    port_map   = arte["port_map"]
    lider_map  = arte["lider_map"]
    p_med      = arte["presupuesto_median"]
    umbral     = arte["metricas"]["umbral_alerta"]

    port_enc  = port_map.get(portafolio, 0)
    lider_enc = lider_map.get(lider, int(np.median(list(lider_map.values()))))
    if presupuesto is None:
        presupuesto = p_med
    cpi_m1_cap = min(float(cpi_m1), CPI_CAP)

    X = np.array([[
        int(port_enc), int(lider_enc), float(duracion_meses),
        float(np.log1p(presupuesto)),
        1 if duracion_meses <= 3  else 0,
        1 if 3 < duracion_meses <= 12 else 0,
        1 if duracion_meses > 12 else 0,
        cpi_m1_cap, float(spi_m1), float(va_m1),
    ]])

    prob = float(arte["modelo"].predict_proba(X)[0][1])

    # Lookup tasa histórica
    cat = ("corto (<=3m)" if duracion_meses <= 3
           else "mediano (3-12m)" if duracion_meses <= 12
           else "largo (>12m)")
    tasa_hist, n_hist = float("nan"), 0
    for row in arte.get("lookup", []):
        if str(row.get("portafolio")) == portafolio and str(row.get("dur_cat")) == cat:
            tasa_hist = float(row.get("tasa_riesgo", float("nan")))
            n_hist    = int(row.get("n_total", 0))
            break

    # Nivel de riesgo
    if prob >= umbral:
        nivel, semaforo = "ALTO", "ROJO"
        accion = ("Riesgo alto de eficiencia de costo deteriorada. "
                  "Revisar el plan de costos y la asignación de recursos. "
                  "Establecer punto de control de costo en el próximo mes.")
    elif prob >= 0.25:
        nivel, semaforo = "MODERADO", "AMARILLO"
        accion = ("Riesgo moderado de costo. Monitoreo mensual del CPI reforzado. "
                  "Si el CPI cae por segunda vez, escalar a ALTO.")
    else:
        nivel, semaforo = "BAJO", "VERDE"
        accion = ("Perfil de costo saludable. Seguimiento estándar mensual del CPI.")

    # Nota CPI_m1
    if cpi_m1 < 0.80:
        nota_cpi = f"CPI_m1={cpi_m1:.3f} < 0.80: ya en zona de riesgo desde el primer mes."
    elif cpi_m1 < 1.0:
        nota_cpi = f"CPI_m1={cpi_m1:.3f}: eficiencia de costo por debajo del plan. Monitorear."
    else:
        nota_cpi = f"CPI_m1={cpi_m1:.3f}: eficiencia de costo saludable en el primer mes."

    # Vs histórico
    if not np.isnan(tasa_hist) and n_hist >= 2:
        diff = prob - tasa_hist
        if diff > 0.10:
            vs_hist = f"superior a la tasa histórica del segmento ({tasa_hist:.0%}, n={n_hist})"
        elif diff < -0.10:
            vs_hist = f"inferior a la tasa histórica del segmento ({tasa_hist:.0%}, n={n_hist})"
        else:
            vs_hist = f"similar a la tasa histórica del segmento ({tasa_hist:.0%}, n={n_hist})"
    else:
        vs_hist = f"segmento con muestra pequeña (n={n_hist}) — usar con cautela"

    return {
        "probabilidad":     round(prob, 4),
        "probabilidad_pct": f"{prob:.1%}",
        "nivel_riesgo":     nivel,
        "semaforo":         semaforo,
        "accion_sugerida":  accion,
        "nota_cpi_m1":      nota_cpi,
        "vs_historico":     vs_hist,
        "cpi_m1_usado":     round(cpi_m1_cap, 4),
        "umbral_alerta":    umbral,
        "portafolios_disponibles": list(port_map.keys()),
        "lideres_disponibles":     list(lider_map.keys()),
    }


def info_cpi() -> dict:
    out: dict = {"lineas_base": _lb is not None, "modelo": _modelo is not None}
    if _modelo:
        m = _modelo["metricas"]
        out["modelo_metricas"] = {
            "auc": m["auc"], "recall": m["recall"],
            "precision": m["precision"], "umbral_alerta": m["umbral_alerta"],
            "n_proyectos": m["n_proyectos"],
        }
        out["portafolios"]  = list(_modelo["port_map"].keys())
        out["lideres"]      = list(_modelo["lider_map"].keys())
    if _lb:
        out["lb_metadata"] = _lb.get("metadata", {})
    return out
