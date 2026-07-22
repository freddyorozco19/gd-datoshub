"""
datos.py — Líneas base SPC + modelo de predicción cuadrático para Gobierno de Datos.

Carga GobiernoDatos.xlsx al importar, ajusta el modelo una vez y expone funciones puras.

Modelo: Ĉ(Categoria, P) = β₀ + β_cat + β₁·P + β₂·P²
"""
from __future__ import annotations

import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import LeaveOneOut
from scipy.stats import t as t_dist

warnings.filterwarnings("ignore")

DATOS_DIR = Path(__file__).parent / "scripts" / "datos"
XLSX      = DATOS_DIR / "GobiernoDatos.xlsx"

COL_CAT  = "Categoria"
COL_VAR  = "Variable"
COL_PER  = "Periodo"
COL_COB  = "Cubrimiento"
CONF     = 0.95   # nivel de confianza IC

# ── Estado global ──────────────────────────────────────────────────────
_df:         pd.DataFrame | None = None
_cl:         pd.DataFrame | None = None  # (Categoria, Periodo) → CL
_modelo:     LinearRegression | None = None
_feature_cols: list[str] = []
_cat_cols:     list[str] = []
_metricas:   dict | None = None
_X:          np.ndarray | None = None
_y:          np.ndarray | None = None
_categorias: list[str] = []
_periodos:   list[int] = []
_lb_data:    dict | None = None   # líneas base precalculadas


def _load() -> None:
    global _df, _cl, _modelo, _feature_cols, _cat_cols
    global _metricas, _X, _y, _categorias, _periodos, _lb_data

    if not XLSX.exists():
        return

    df = pd.read_excel(XLSX)
    df = df.sort_values(COL_PER).reset_index(drop=True)
    _df = df
    _categorias = sorted(df[COL_CAT].unique().tolist())
    _periodos   = sorted(df[COL_PER].unique().tolist())

    # ── Líneas base (Script 01) ────────────────────────────────────
    sigma_global = df.groupby(COL_CAT)[COL_COB].std().rename("Sigma")
    cl = (df.groupby([COL_CAT, COL_PER])[COL_COB]
            .mean().reset_index().rename(columns={COL_COB: "CL"}))
    cl = cl.merge(sigma_global, on=COL_CAT)
    cl["UCL"] = (cl["CL"] + 3 * cl["Sigma"]).clip(upper=1.0)
    cl["LCL"] = (cl["CL"] - 3 * cl["Sigma"]).clip(lower=0.0)
    _cl = cl

    # Serializar líneas base
    lb: dict[str, dict] = {}
    for cat in _categorias:
        sub = cl[cl[COL_CAT] == cat].sort_values(COL_PER)
        sigma = float(sub["Sigma"].iloc[0]) if len(sub) else 0.0
        periodos_data = []
        for _, row in sub.iterrows():
            periodos_data.append({
                "periodo": int(row[COL_PER]),
                "CL": round(float(row["CL"]), 4),
                "UCL": round(float(row["UCL"]), 4),
                "LCL": round(float(row["LCL"]), 4),
            })
        lb[cat] = {"sigma": round(sigma, 6), "periodos": periodos_data}

    _lb_data = {"categorias": lb, "periodos_disponibles": _periodos}

    # ── Modelo cuadrático (Script 02) ─────────────────────────────
    dummies   = pd.get_dummies(cl[COL_CAT], prefix="Cat", drop_first=False).astype(float)
    cat_cols  = list(dummies.columns)
    cl_feat   = pd.concat([cl, dummies], axis=1).copy()
    cl_feat["Per2"] = cl_feat[COL_PER] ** 2

    feature_cols = cat_cols + [COL_PER, "Per2"]
    X = cl_feat[feature_cols].values
    y = cl_feat["CL"].values

    modelo = LinearRegression(fit_intercept=True)
    modelo.fit(X, y)

    n, p = X.shape[0], X.shape[1] + 1
    y_hat  = modelo.predict(X)
    s2     = float(np.sum((y - y_hat) ** 2) / (n - p)) if n > p else 0.0

    loo_errors = []
    loo = LeaveOneOut()
    for tr, te in loo.split(X):
        m2 = LinearRegression(fit_intercept=True)
        m2.fit(X[tr], y[tr])
        loo_errors.append((y[te][0] - m2.predict(X[te])[0]) ** 2)

    _modelo      = modelo
    _feature_cols = feature_cols
    _cat_cols    = cat_cols
    _X, _y       = X, y
    _metricas    = {
        "r2":       round(float(r2_score(y, y_hat)), 4),
        "rmse":     round(float(np.sqrt(mean_squared_error(y, y_hat))), 6),
        "mae":      round(float(mean_absolute_error(y, y_hat)), 6),
        "rmse_loo": round(float(np.sqrt(np.mean(loo_errors))), 6),
        "n": n, "p": p, "s2": s2,
    }


_load()


# ── API pública ────────────────────────────────────────────────────────

def _global_block(df: "pd.DataFrame") -> dict:
    vals = df[COL_COB].values
    mean = float(np.mean(vals))
    std  = float(np.std(vals, ddof=1)) if len(vals) > 1 else 0.0
    cv   = abs(std / mean * 100) if mean != 0 else 0.0
    return {
        "n":     int(len(vals)),
        "cl":    round(mean, 4),
        "sigma": round(std, 6),
        "cv":    round(cv, 2),
        "ucl":   round(min(mean + 3 * std, 1.0), 4),
        "lcl":   round(max(mean - 3 * std, 0.0), 4),
    }


def lineas_base() -> dict:
    if _lb_data is None or _df is None:
        raise RuntimeError("Datos de GobiernoDatos no disponibles.")
    return {**_lb_data, "global": _global_block(_df)}


def lineas_base_desde_bytes(xlsx_bytes: bytes) -> dict:
    import io
    df = pd.read_excel(io.BytesIO(xlsx_bytes))
    df = df.sort_values(COL_PER).reset_index(drop=True)
    sigma_global = df.groupby(COL_CAT)[COL_COB].std().rename("Sigma")
    cl = (df.groupby([COL_CAT, COL_PER])[COL_COB]
            .mean().reset_index().rename(columns={COL_COB: "CL"}))
    cl = cl.merge(sigma_global, on=COL_CAT)
    cl["UCL"] = (cl["CL"] + 3 * cl["Sigma"]).clip(upper=1.0)
    cl["LCL"] = (cl["CL"] - 3 * cl["Sigma"]).clip(lower=0.0)
    categorias = sorted(df[COL_CAT].unique().tolist())
    lb: dict = {}
    for cat in categorias:
        sub = cl[cl[COL_CAT] == cat].sort_values(COL_PER)
        sigma = float(sub["Sigma"].iloc[0]) if len(sub) else 0.0
        lb[cat] = {
            "sigma": round(sigma, 6),
            "periodos": [
                {"periodo": int(r[COL_PER]), "CL": round(float(r["CL"]), 4),
                 "UCL": round(float(r["UCL"]), 4), "LCL": round(float(r["LCL"]), 4)}
                for _, r in sub.iterrows()
            ],
        }
    return {
        "categorias": lb,
        "periodos_disponibles": sorted(df[COL_PER].unique().tolist()),
        "global": _global_block(df),
    }


def predecir(categoria: str, periodo: int | float) -> dict:
    if _modelo is None or _metricas is None:
        raise RuntimeError("Modelo de GobiernoDatos no disponible.")

    key = f"Cat_{categoria}"
    if key not in _cat_cols:
        cats_validas = [c.replace("Cat_", "") for c in _cat_cols]
        raise ValueError(
            f"Categoría '{categoria}' no válida. Opciones: {cats_validas}"
        )

    row = {c: 0.0 for c in _cat_cols}
    row[key] = 1.0
    x_new = np.array([[row[c] for c in _cat_cols] + [float(periodo), float(periodo) ** 2]])

    pred = float(np.clip(_modelo.predict(x_new)[0], 0, 1))

    # Intervalo de predicción exacto OLS
    n, p  = _metricas["n"], _metricas["p"]
    s2    = _metricas["s2"]
    X_aug = np.hstack([np.ones((_X.shape[0], 1)), _X])
    x_aug = np.hstack([[1.0], x_new[0]])
    try:
        XtXinv = np.linalg.pinv(X_aug.T @ X_aug)
        lev    = float(x_aug @ XtXinv @ x_aug)
        se     = float(np.sqrt(s2 * (1 + lev)))
    except Exception:
        se = float(np.sqrt(s2))
    tc = float(t_dist.ppf((1 + CONF) / 2, df=max(n - p, 1)))
    lo = float(np.clip(pred - tc * se, 0, 1))
    hi = float(np.clip(pred + tc * se, 0, 1))

    semaforo = "VERDE" if pred >= 0.80 else "AMARILLO" if pred >= 0.60 else "ROJO"
    p_max = max(_periodos) if _periodos else 0
    es_proyeccion = periodo > p_max

    return {
        "categoria":    categoria,
        "periodo":      int(periodo),
        "prediccion":   round(pred, 4),
        "prediccion_pct": f"{pred:.1%}",
        "ic_lo":        round(lo, 4),
        "ic_lo_pct":    f"{lo:.1%}",
        "ic_hi":        round(hi, 4),
        "ic_hi_pct":    f"{hi:.1%}",
        "nivel_confianza": CONF,
        "semaforo":     semaforo,
        "es_proyeccion": es_proyeccion,
        "periodo_max_historico": p_max,
        "modelo": _metricas,
    }


def recargar(xlsx_bytes: bytes) -> dict:
    """Reemplaza el Excel en disco y recalcula el modelo en memoria."""
    import io
    # Validar columnas mínimas
    try:
        df_test = pd.read_excel(io.BytesIO(xlsx_bytes))
    except Exception as e:
        raise ValueError(f"No se pudo leer el archivo Excel: {e}")
    requeridas = {COL_CAT, COL_PER, COL_COB}
    faltantes  = requeridas - set(df_test.columns)
    if faltantes:
        raise ValueError(f"Columnas faltantes en el Excel: {faltantes}. Esperadas: {requeridas}")
    XLSX.write_bytes(xlsx_bytes)
    _load()
    return {
        "ok":        True,
        "n_obs":     int(_df.shape[0]) if _df is not None else 0,
        "categorias": _categorias,
        "periodos":  _periodos,
        "metricas":  _metricas,
    }


def info_datos() -> dict:
    """Resumen del Excel de entrenamiento de Gobierno de Datos."""
    if _df is None or not XLSX.exists():
        return {"disponible": False}

    df = _df.copy()
    cats = sorted(df[COL_CAT].unique().tolist())
    periodos = sorted(df[COL_PER].unique().tolist())
    vars_unicas = sorted(df[COL_VAR].unique().tolist())

    # Resumen por categoría
    por_cat: dict = {}
    for cat, grp in df.groupby(COL_CAT):
        cob = grp[COL_COB].dropna()
        por_cat[str(cat)] = {
            "n_obs":         int(len(grp)),
            "n_periodos":    int(grp[COL_PER].nunique()),
            "variables":     sorted(grp[COL_VAR].unique().tolist()),
            "cob_media":     f"{float(cob.mean()):.1%}",
            "cob_min":       f"{float(cob.min()):.1%}",
            "cob_max":       f"{float(cob.max()):.1%}",
        }

    # Tabla detalle: una fila por (categoria, variable, periodo)
    registros = []
    for _, row in df.iterrows():
        registros.append({
            "categoria": str(row[COL_CAT]),
            "variable":  str(row[COL_VAR]),
            "periodo":   int(row[COL_PER]),
            "cobertura": f"{row[COL_COB]:.1%}",
            "cob_v":     round(float(row[COL_COB]), 4),
        })

    return {
        "disponible":    True,
        "n_obs":         int(len(df)),
        "n_categorias":  len(cats),
        "n_periodos":    len(periodos),
        "periodos":      periodos,
        "variables":     vars_unicas,
        "xlsx_bytes":    XLSX.stat().st_size,
        "por_categoria": por_cat,
        "registros":     registros,
        "modelo_r2":     round(_metricas["r2"],    4) if _metricas else None,
        "modelo_rmse":   round(_metricas["rmse"],  4) if _metricas else None,
    }


def status() -> dict:
    return {
        "xlsx_disponible": XLSX.exists(),
        "modelo_ajustado": _modelo is not None,
        "n_obs":           int(_df.shape[0]) if _df is not None else 0,
        "categorias":      _categorias,
        "periodos":        _periodos,
        "metricas":        _metricas,
    }
