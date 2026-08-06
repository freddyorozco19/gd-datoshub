"""
cpi.py — Líneas base CPI + Predictor de riesgo de costo (Proyectos 2).

Carga lineas_base.json y modelo_CPI_params.pkl al importar.
Expone funciones puras para la API FastAPI.
"""
from __future__ import annotations

import base64
import io
import json
import pickle
import warnings
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd

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

_lb_cerrados: dict | None = None
_lb_cerrados_path = PROJ_DIR / "lineas_base_cpi_cerrados.json"
if _lb_cerrados_path.exists():
    _lb_cerrados = json.loads(_lb_cerrados_path.read_text(encoding="utf-8"))

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


def lineas_base_cpi_cerrados() -> dict:
    if _lb_cerrados is None:
        raise RuntimeError("Líneas base CPI Cerrados no disponibles.")
    result = dict(_lb_cerrados)
    result["señales"] = _señales_cerrados(_lb_cerrados)
    result["images"]  = _graficas_cerrados(_lb_cerrados)
    return result


def _señales_cerrados(lb: dict) -> list[dict]:
    """Genera tabla de señales Nelson detectadas por indicador."""
    señales: list[dict] = []
    for ind in ["CPI", "SPI", "VA"]:
        ind_data = lb["global"].get(ind, {})
        vals     = ind_data.get("valores", [])
        glb      = ind_data.get("global", {})
        if not vals or not glb:
            continue
        s     = np.array(vals, dtype=float)
        n     = len(s)
        mu    = glb["CL"]
        sigma = glb["std"]
        above = (s > mu).astype(int)

        # R1: punto fuera de ±3σ
        for i, v in enumerate(s):
            if v > mu + 3 * sigma:
                señales.append({"regla": "R1", "ind": ind, "idx": i + 1, "valor": round(float(v), 4), "desc": f"Sobre UCL (+3σ)"})
            elif v < mu - 3 * sigma:
                señales.append({"regla": "R1", "ind": ind, "idx": i + 1, "valor": round(float(v), 4), "desc": f"Bajo LCL (-3σ)"})

        # R2: 9+ consecutivos mismo lado
        for i in range(n - 8):
            if above[i:i+9].sum() == 9:
                señales.append({"regla": "R2", "ind": ind, "idx": i + 9, "valor": round(float(s[i+8]), 4), "desc": "9+ consec. sobre CL"})
            elif (1 - above[i:i+9]).sum() == 9:
                señales.append({"regla": "R2", "ind": ind, "idx": i + 9, "valor": round(float(s[i+8]), 4), "desc": "9+ consec. bajo CL"})

        # R6: 4 de 5 puntos fuera de ±1σ
        for i in range(n - 4):
            seg = s[i:i+5]
            if ((seg > mu + sigma) | (seg < mu - sigma)).sum() >= 4:
                señales.append({"regla": "R6", "ind": ind, "idx": i + 5, "valor": round(float(s[i+4]), 4), "desc": "4 de 5 fuera de ±1σ"})

    señales.sort(key=lambda x: (x["regla"], x["ind"], x["idx"]))
    return señales


def _fig_to_b64(fig: "plt.Figure") -> str:
    buf = io.BytesIO()
    fig.savefig(buf, dpi=120, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _graficas_cerrados(lb: dict) -> dict:
    GRAY   = "#374151"
    LIGHT  = "#9CA3AF"
    INDIGO = "#4F46E5"
    RED    = "#EF4444"
    BLUE   = "#3B82F6"
    BG     = "white"

    indicadores = ["CPI", "SPI", "VA"]
    etiquetas   = {"CPI": f"CPI (techo {lb['metadata']['cpi_cap']})", "SPI": "SPI", "VA": "Variación Alcance"}

    # ── 1. Gráfica de control (scatter con bandas) ────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(18, 5), facecolor=BG)
    fig.suptitle("Gráfica de Control — Proyectos Cerrados (estado al cierre)",
                 fontsize=13, fontweight="bold", color=GRAY, y=1.01)

    for ax, ind in zip(axes, indicadores):
        glb    = lb["global"][ind]["global"]
        vals   = lb["global"][ind]["valores"]
        cl, ucl, lcl = glb["CL"], glb["UCL"], glb["LCL"]
        xs = list(range(1, len(vals) + 1))
        colores = [RED if (v > ucl or v < lcl) else INDIGO for v in vals]

        ax.axhline(cl,  color=BLUE,  lw=1.5, ls="--", label=f"CL={cl:.3f}")
        ax.axhline(ucl, color=RED,   lw=1,   ls=":",  label=f"UCL={ucl:.3f}")
        ax.axhline(lcl, color=RED,   lw=1,   ls=":",  label=f"LCL={lcl:.3f}")
        ax.fill_between([0, len(vals)+1], lcl, ucl, color=INDIGO, alpha=0.06)
        ax.scatter(xs, vals, c=colores, s=55, zorder=5, edgecolors="white", linewidths=0.5)
        ax.plot(xs, vals, color=INDIGO, lw=1, alpha=0.4, zorder=4)

        ax.set_title(etiquetas[ind], fontsize=11, fontweight="bold", color=GRAY, pad=8)
        ax.set_xlabel("Proyecto #", fontsize=9, color=LIGHT)
        ax.set_ylabel(ind, fontsize=9, color=LIGHT)
        ax.tick_params(colors=LIGHT, labelsize=8)
        ax.spines[["top","right"]].set_visible(False)
        ax.spines[["left","bottom"]].set_color("#E5E7EB")
        ax.set_facecolor(BG)
        ax.set_xlim(0, len(vals)+1)
        ax.legend(fontsize=7.5, framealpha=0.7, loc="upper right")

        fuera = sum(1 for v in vals if v > ucl or v < lcl)
        ax.text(0.02, 0.03, f"{fuera} punt. fuera de control",
                transform=ax.transAxes, fontsize=8, color=RED if fuera else LIGHT)

    fig.tight_layout()
    img_control = _fig_to_b64(fig)

    # ── 2. Histograma de distribución ────────────────────────────────
    fig, axes = plt.subplots(1, 3, figsize=(18, 5), facecolor=BG)
    fig.suptitle("Distribución de Indicadores al Cierre — Proyectos Cerrados",
                 fontsize=13, fontweight="bold", color=GRAY, y=1.01)

    for ax, ind in zip(axes, indicadores):
        glb  = lb["global"][ind]["global"]
        vals = lb["global"][ind]["valores"]
        cl, ucl, lcl = glb["CL"], glb["UCL"], glb["LCL"]
        mn, mx = min(vals), max(vals)
        bins = 8
        w = (mx - mn) / bins or 1e-9
        edges = [mn + i * w for i in range(bins + 1)]

        counts = [0] * bins
        for v in vals:
            idx = min(int((v - mn) / w), bins - 1)
            counts[idx] += 1

        centers = [(edges[i] + edges[i+1]) / 2 for i in range(bins)]
        colors  = [INDIGO if (edges[i] >= lcl and edges[i+1] <= ucl) else RED for i in range(bins)]

        bars = ax.bar(centers, counts, width=w * 0.85, color=colors, edgecolor="white", linewidth=0.6)
        ax.axvline(cl,  color=BLUE, lw=1.5, ls="--", label=f"CL={cl:.3f}")
        ax.axvline(ucl, color=RED,  lw=1,   ls=":",  label=f"UCL={ucl:.3f}")
        ax.axvline(lcl, color=RED,  lw=1,   ls=":",  label=f"LCL={lcl:.3f}")

        for bar, cnt in zip(bars, counts):
            if cnt:
                ax.text(bar.get_x() + bar.get_width()/2, cnt + 0.1, str(cnt),
                        ha="center", va="bottom", fontsize=8, color=GRAY)

        ax.set_title(etiquetas[ind], fontsize=11, fontweight="bold", color=GRAY, pad=8)
        ax.set_xlabel(ind, fontsize=9, color=LIGHT)
        ax.set_ylabel("N proyectos", fontsize=9, color=LIGHT)
        ax.tick_params(colors=LIGHT, labelsize=8)
        ax.xaxis.set_major_formatter(mticker.FormatStrFormatter("%.2f"))
        ax.spines[["top","right"]].set_visible(False)
        ax.spines[["left","bottom"]].set_color("#E5E7EB")
        ax.set_facecolor(BG)
        ax.legend(fontsize=7.5, framealpha=0.7, loc="upper right")
        ax.set_xlim(mn - w * 0.5, mx + w * 0.5)

    fig.tight_layout()
    img_hist = _fig_to_b64(fig)

    return {"control_chart": img_control, "histograma": img_hist}


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


def _stats_por_bin(df: "pd.DataFrame", col: str, lcl_min: float | None = None) -> dict:
    bins: dict = {}
    for lbl in BIN_LABELS:
        vals = df.loc[df["_bin"] == lbl, col].dropna()
        n = len(vals)
        if n == 0:
            bins[lbl] = {"n": 0, "CL": None, "UCL": None, "LCL": None,
                         "std": None, "CV": None, "median": None, "outliers": 0}
            continue
        cl  = float(vals.mean())
        std = float(vals.std()) if n > 1 else 0.0
        ucl = cl + 3 * std
        lcl = cl - 3 * std
        if lcl_min is not None:
            lcl = max(lcl_min, lcl)
        cv  = (std / abs(cl) * 100) if cl != 0 else None
        out = int(((vals > ucl) | (vals < lcl)).sum())
        bins[lbl] = {"n": n, "CL": round(cl, 6), "UCL": round(ucl, 6),
                     "LCL": round(lcl, 6), "std": round(std, 6),
                     "CV": round(cv, 2) if cv is not None else None,
                     "median": round(float(vals.median()), 6), "outliers": out}
    return bins


def _stats_globales(serie: "pd.Series") -> dict:
    mu  = float(serie.mean())
    sig = float(serie.std())
    cv  = (sig / abs(mu) * 100) if mu != 0 else None
    return {"n": int(len(serie)), "CL": round(mu, 6),
            "UCL": round(mu + 3 * sig, 6), "LCL": round(mu - 3 * sig, 6),
            "std": round(sig, 6),
            "CV": round(cv, 2) if cv is not None else None,
            "median": round(float(serie.median()), 6)}


def _nelson_rules(series: "pd.Series") -> dict:
    s = series.dropna().values
    n = len(s)
    if n < 9:
        return {"R1": 0, "R2": 0, "R3": 0, "R4": 0, "R6": 0,
                "reglas_activas": [], "veredicto": "INSUFICIENTE (n<9)", "n": n}
    mu = s.mean(); sigma = s.std()
    above = (s > mu).astype(int)
    r1 = int(np.sum((s > mu + 3 * sigma) | (s < mu - 3 * sigma)))
    r2 = sum(1 for i in range(n - 8)
             if above[i:i+9].sum() == 9 or (1 - above[i:i+9]).sum() == 9)
    r3 = sum(1 for i in range(n - 5)
             if all(s[i+j] < s[i+j+1] for j in range(5))
             or all(s[i+j] > s[i+j+1] for j in range(5)))
    r4 = 0
    if n >= 14:
        diffs = np.diff(s)
        for i in range(len(diffs) - 12):
            if all(diffs[i+j] * diffs[i+j+1] < 0 for j in range(12)):
                r4 += 1
    r6 = sum(1 for i in range(n - 4)
             if ((s[i:i+5] > mu + sigma) | (s[i:i+5] < mu - sigma)).sum() >= 4)
    activas = [k for k, v in {"R1": r1, "R2": r2, "R3": r3, "R4": r4, "R6": r6}.items() if v > 0]
    veredicto = ("CONTROLADO" if not activas
                 else "MARGINAL" if len(activas) <= 2 and r2 == 0
                 else "NO CONTROLADO")
    return {"R1": r1, "R2": r2, "R3": r3, "R4": r4, "R6": r6,
            "reglas_activas": activas, "veredicto": veredicto, "n": n}


def _calcular_scope(sub: "pd.DataFrame") -> dict:
    COLS = {
        "SPI":  {"col": "SPI",     "lcl_min": 0.0},
        "CPI":  {"col": "CPI_cap", "lcl_min": None},
        "VA":   {"col": "VA",      "lcl_min": None},
    }
    data: dict = {"n_proyectos": int(sub["ProjectId"].nunique()), "n_obs": int(len(sub))}
    for ind_key, cfg in COLS.items():
        col    = cfg["col"]
        serie  = sub[col].dropna()
        glb    = _stats_globales(serie)
        if cfg["lcl_min"] is not None:
            glb["LCL"] = max(cfg["lcl_min"], glb["LCL"])
        bins   = _stats_por_bin(sub, col, lcl_min=cfg["lcl_min"])
        nelson = _nelson_rules(sub.sort_values("mes_rel")[col].dropna().reset_index(drop=True))
        data[ind_key] = {"global": glb, "por_fase": bins, "nelson": nelson}
    return data


_COLUMNAS_REQUERIDAS = [
    "Mes Relativo", "SPI (Schedule Performance Index)",
    "CPI (Cost Performance Index)", "Variación Avance",
    "Portafolio", "ProjectId",
]


def lineas_base_desde_excel(raw_bytes: bytes) -> dict:
    df = pd.read_excel(pd.io.common.BytesIO(raw_bytes))
    faltantes = [c for c in _COLUMNAS_REQUERIDAS if c not in df.columns]
    if faltantes:
        raise ValueError(f"Columnas faltantes: {faltantes}")
    df = df.rename(columns={
        "Mes Relativo":                        "mes_rel",
        "SPI (Schedule Performance Index)":    "SPI",
        "CPI (Cost Performance Index)":        "CPI",
        "Variación Avance":                    "VA",
        "Portafolio":                          "portafolio",
    })
    # Columnas numéricas pueden llegar como object si el Excel tiene texto ("No se realizó gasto…")
    for _col in ("CPI", "SPI", "VA", "mes_rel"):
        if _col in df.columns:
            df[_col] = pd.to_numeric(df[_col], errors="coerce")
    df["CPI_cap"] = df["CPI"].clip(upper=CPI_CAP)
    df["_bin"] = pd.cut(df["mes_rel"], bins=10,
                        labels=BIN_LABELS, include_lowest=True)
    lb: dict = {
        "metadata": {
            "n_obs":        int(len(df)),
            "n_proyectos":  int(df["ProjectId"].nunique()),
            "portafolios":  list(df["portafolio"].unique()),
            "cpi_cap":      CPI_CAP,
            "bin_labels":   BIN_LABELS,
            "indicadores":  ["SPI", "CPI", "VA"],
        },
        "global":          _calcular_scope(df),
        "por_portafolio":  {},
    }
    for port in df["portafolio"].unique():
        lb["por_portafolio"][port] = _calcular_scope(df[df["portafolio"] == port])
    return lb


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
