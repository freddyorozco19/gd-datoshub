"""
financiero.py — Líneas base de utilidad + regresión OLS (Análisis 3).

Carga Utilidad_Proyectos.xlsx al importar, ajusta el modelo una vez
y expone funciones puras sin subprocess.
"""
from __future__ import annotations

import unicodedata
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from numpy.linalg import lstsq
from scipy.stats import f as f_dist, shapiro, t as t_dist

warnings.filterwarnings("ignore")

def _norm_col(name: str) -> str:
    """Normaliza NFC y quita espacios extremos para hacer match robusto de columnas."""
    return unicodedata.normalize("NFC", str(name)).strip()

def _fix_cols(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = [_norm_col(c) for c in df.columns]
    return df

FIN_DIR  = Path(__file__).parent / "scripts" / "financiero"
XLSX     = FIN_DIR / "Utilidad_Proyectos.xlsx"
CAT_REF  = "Arquitectura Empresarial"
UMBRAL_Z = 2.5
N_MIN    = 3   # mínimo proyectos para línea base por categoría

# ── Normalización de categorías ────────────────────────────────────────
def _norm(cat: str) -> str:
    c = str(cat).strip().upper()
    if "SOSTENIB"  in c: return "Sostenibilidad"
    if "TRANSFORM" in c: return "Transformación Digital"
    if "GOBIERNO"  in c: return "Gobierno de Datos"
    if "PROCESO"   in c: return "Procesos"
    if "MIGRAC"    in c: return "Migración"
    if "ARQUITECT" in c: return "Arquitectura Empresarial"
    if "CIBERSEG"  in c and "INFRAESTR" in c and "SERVIC" in c:
        return "Infra + Servicios + Ciber"
    if "INFRAESTR" in c and "SERVIC" in c:
        return "Infra + Servicios gestionados"
    if "CIBERSEG"  in c or "SEGURIDAD" in c: return "Ciberseguridad"
    if "INFRAESTR" in c: return "Infraestructura"
    if "SERVIC"    in c: return "Servicios gestionados"
    if "ANALÍT"    in c or "ANALITIC" in c or "ANALÍTICA" in c: return "Analítica / IA"
    if "DESARROLL" in c: return "Desarrollo"
    return str(cat).strip()

# ── Reglas de Nelson ───────────────────────────────────────────────────
def _nelson(u: np.ndarray, mean: float, std: float) -> dict[int, list[int]]:
    u1p = mean + std;  u1n = mean - std
    ucl = mean + 3 * std;  lcl = mean - 3 * std
    n   = len(u)
    v: dict[int, list[int]] = {1: [], 2: [], 3: [], 4: [], 6: []}

    for i, val in enumerate(u):
        if val > ucl or val < lcl:
            v[1].append(i + 1)
    for i in range(n - 8):
        seg = u[i:i + 9]
        if (seg > mean).all() or (seg < mean).all():
            for j in range(i, i + 9):
                if j + 1 not in v[2]: v[2].append(j + 1)
    for i in range(n - 5):
        d = np.diff(u[i:i + 6])
        if (d > 0).all() or (d < 0).all():
            for j in range(i, i + 6):
                if j + 1 not in v[3]: v[3].append(j + 1)
    for i in range(n - 13):
        d = np.diff(u[i:i + 14])
        if all((d[j] > 0) != (d[j + 1] > 0) for j in range(len(d) - 1)):
            for j in range(i, i + 14):
                if j + 1 not in v[4]: v[4].append(j + 1)
    for i in range(n - 4):
        seg = u[i:i + 5]
        if (seg > u1p).sum() >= 4 or (seg < u1n).sum() >= 4:
            for j in range(i, i + 5):
                if j + 1 not in v[6]: v[6].append(j + 1)
    return v

def _risk(viol: dict, cv: float) -> str:
    if viol[1] or cv > 100: return "Alto"
    if cv > 70 or any(viol[r] for r in (2, 3, 4, 6)): return "Medio"
    return "Bajo"

def _stats_block(u: np.ndarray) -> dict:
    n    = len(u)
    mean = float(np.mean(u))
    std  = float(np.std(u, ddof=1)) if n > 1 else 0.0
    cv   = abs(std / mean * 100) if mean != 0 else float("nan")
    ucl  = mean + 3 * std;  lcl  = mean - 3 * std
    sw_p = float(shapiro(u)[1]) if n >= 3 else float("nan")
    viol = _nelson(u, mean, std)
    return dict(
        n=n, mean=round(mean, 6), std=round(std, 6),
        cv=round(cv, 2),
        ucl=round(ucl, 6), lcl=round(lcl, 6),
        u1p=round(mean + std, 6),   u1n=round(mean - std, 6),
        u2p=round(mean + 2*std, 6), u2n=round(mean - 2*std, 6),
        sw_p=round(sw_p, 4),
        nelson=_nelson_summary(viol),
        bajo_control=not any(viol[r] for r in viol),
        riesgo=_risk(viol, cv),
    )

def _nelson_summary(viol: dict) -> dict:
    return {f"R{r}": len(pts) for r, pts in viol.items()}

# ── OLS ────────────────────────────────────────────────────────────────
def _build_ols(data: pd.DataFrame) -> dict:
    cats_d = sorted([c for c in data["Cat"].unique() if c != CAT_REF])
    X_cols = [np.ones(len(data)), data["Monto_B"].values]
    for c in cats_d:
        X_cols.append((data["Cat"] == c).astype(float).values)
    X  = np.column_stack(X_cols)
    y  = data["Utilidad del proyecto"].values
    n, k = len(y), X.shape[1] - 1

    b, _, _, _ = lstsq(X, y, rcond=None)
    yp     = X @ b
    ss_res = float(np.sum((y - yp) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r2     = 1 - ss_res / ss_tot if ss_tot else 0
    r2a    = 1 - (1 - r2) * (n - 1) / (n - k - 1) if n > k + 1 else r2
    F      = ((ss_tot - ss_res) / k) / (ss_res / (n - k - 1)) if n > k + 1 else 0
    pF     = float(1 - f_dist.cdf(F, k, n - k - 1))
    rmse   = float(np.sqrt(ss_res / n))
    mse    = ss_res / (n - k - 1) if n > k + 1 else ss_res

    try:
        cov = mse * np.linalg.inv(X.T @ X)
        se  = np.sqrt(np.diag(cov))
        tv  = b / se
        pv  = 2 * (1 - t_dist.cdf(np.abs(tv), df=n - k - 1))
    except Exception:
        pv = np.full(len(b), float("nan"))

    coefs: dict[str, dict] = {CAT_REF: {"beta_i": 0.0, "int_efectivo": float(b[0]), "p_value": float(pv[0])}}
    for i, c in enumerate(cats_d):
        coefs[c] = {
            "beta_i": round(float(b[i + 2]), 6),
            "int_efectivo": round(float(b[0] + b[i + 2]), 6),
            "p_value": round(float(pv[i + 2]), 4),
        }

    return dict(
        n=n, k=k,
        b0=round(float(b[0]), 6),
        b_monto=round(float(b[1]), 8),
        p_monto=round(float(pv[1]), 4),
        r2=round(r2, 4), r2a=round(r2a, 4),
        pF=round(pF, 4), rmse=round(rmse, 6),
        coefs=coefs, cats_d=cats_d,
        b=b,
    )

# ── Carga inicial ──────────────────────────────────────────────────────
_df:      pd.DataFrame | None = None
_modelo_b: dict | None        = None
_lb_global: dict | None       = None
_lb_cats:   dict | None       = None
_cats_validas: list[str]      = []

def _load() -> None:
    global _df, _modelo_b, _lb_global, _lb_cats, _cats_validas
    if not XLSX.exists():
        return

    df = pd.read_excel(XLSX)
    df = _fix_cols(df)
    df = df.dropna(subset=["Utilidad del proyecto"])
    df["Fecha de finalización"] = pd.to_datetime(df["Fecha de finalización"], errors="coerce")
    df = df.sort_values("Fecha de finalización").reset_index(drop=True)
    df["Cat"] = df["Categoría de proyecto"].apply(_norm)

    _df = df
    _lb_global = _stats_block(df["Utilidad del proyecto"].values)

    counts = df["Cat"].value_counts()
    _cats_validas = counts[counts >= N_MIN].index.tolist()
    _lb_cats = {}
    for cat in _cats_validas:
        sub = df[df["Cat"] == cat]
        _lb_cats[cat] = _stats_block(sub["Utilidad del proyecto"].values)

    if "Monto del Proyecto" not in df.columns:
        df["Monto del Proyecto"] = np.nan
    df_reg = df.dropna(subset=["Monto del Proyecto"]).copy()
    df_reg["Monto_B"] = df_reg["Monto del Proyecto"] / 1e9
    u_all  = df_reg["Utilidad del proyecto"].values
    z      = (u_all - np.mean(u_all)) / np.std(u_all, ddof=1)
    df_B   = df_reg[np.abs(z) <= UMBRAL_Z].reset_index(drop=True)
    _modelo_b = _build_ols(df_B)

_load()

# ── API pública ────────────────────────────────────────────────────────

def lineas_base() -> dict:
    if _lb_global is None:
        raise RuntimeError("Datos de Financiero no disponibles.")
    return {
        "global": _lb_global,
        "por_categoria": _lb_cats or {},
        "categorias_disponibles": _cats_validas,
    }


def predecir_utilidad(categoria: str, monto_cop: float) -> dict:
    if _modelo_b is None:
        raise RuntimeError("Modelo de Financiero no disponible.")

    m  = _modelo_b
    cat_norm = _norm(categoria)
    aviso: str | None = None

    if cat_norm in m["coefs"]:
        beta_i = m["coefs"][cat_norm]["beta_i"]
        int_ef = m["coefs"][cat_norm]["int_efectivo"]
    else:
        aviso  = f"Categoría '{categoria}' no reconocida — usando referencia ({CAT_REF})."
        beta_i = 0.0
        int_ef = m["b0"]

    monto_b  = monto_cop / 1e9
    util_est = float(m["b_monto"] * monto_b + m["b0"] + beta_i)
    inf      = util_est - 2 * m["rmse"]
    sup      = util_est + 2 * m["rmse"]

    semaforo = ("VERDE"    if util_est >= 0.20
                else "AMARILLO" if util_est >= 0.05
                else "ROJO")

    return {
        "categoria":         cat_norm,
        "monto_cop":         monto_cop,
        "monto_miles_mm":    round(monto_b, 3),
        "utilidad_estimada": round(util_est, 4),
        "utilidad_pct":      f"{util_est:.1%}",
        "intervalo_min":     round(inf, 4),
        "intervalo_min_pct": f"{inf:.1%}",
        "intervalo_max":     round(sup, 4),
        "intervalo_max_pct": f"{sup:.1%}",
        "rmse":              m["rmse"],
        "semaforo":          semaforo,
        "advertencia":       aviso,
        "modelo": {
            "r2":    m["r2"],  "r2a":   m["r2a"],
            "pF":    m["pF"],  "rmse":  m["rmse"],
            "n":     m["n"],
        },
    }


def recargar(xlsx_bytes: bytes) -> dict:
    """Reemplaza el Excel en disco y recalcula el modelo en memoria."""
    import io
    try:
        df_test = pd.read_excel(io.BytesIO(xlsx_bytes))
    except Exception as e:
        raise ValueError(f"No se pudo leer el archivo Excel: {e}")
    df_test = _fix_cols(df_test)
    requeridas = {"Utilidad del proyecto", "Categoría de proyecto", "Fecha de finalización"}
    faltantes  = requeridas - set(df_test.columns)
    if faltantes:
        raise ValueError(f"Columnas faltantes: {faltantes}. Esperadas: {requeridas}")
    XLSX.write_bytes(xlsx_bytes)
    _load()
    return {
        "ok":          True,
        "n_proyectos": int(_df.shape[0]) if _df is not None else 0,
        "categorias":  _cats_validas,
        "modelo_b":    {"r2": _modelo_b["r2"], "rmse": _modelo_b["rmse"], "n": _modelo_b["n"]}
                       if _modelo_b else None,
    }


def info_financiero() -> dict:
    """Resumen del Excel de entrenamiento para ilustrar los datos origen."""
    if _df is None or not XLSX.exists():
        return {"disponible": False}

    df = _df.copy()
    fecha_max = df["Fecha de finalización"].max()
    fecha_min = df["Fecha de finalización"].min()

    por_cat: dict = {}
    for cat, grp in df.groupby("Cat"):
        utils = grp["Utilidad del proyecto"].dropna()
        montos = grp["Monto del Proyecto"].dropna()
        por_cat[str(cat)] = {
            "n": int(len(grp)),
            "utilidad_media": f"{float(utils.mean()):.1%}",
            "utilidad_min":   f"{float(utils.min()):.1%}",
            "utilidad_max":   f"{float(utils.max()):.1%}",
            "monto_medio_mm": round(float(montos.mean()) / 1e6, 1) if len(montos) > 0 else None,
        }

    proyectos: list[dict] = []
    for _, row in df.iterrows():
        fecha = row["Fecha de finalización"]
        proyectos.append({
            "codigo":    str(row.get("Código de proyecto", ""))[:10] + "…",
            "categoria": str(row["Cat"]),
            "utilidad":  f"{row['Utilidad del proyecto']:.1%}",
            "utilidad_v": round(float(row["Utilidad del proyecto"]), 4),
            "monto_mm":  round(float(row["Monto del Proyecto"]) / 1e6, 1) if pd.notna(row.get("Monto del Proyecto")) else None,
            "fecha":     fecha.strftime("%Y-%m") if pd.notna(fecha) else None,
        })

    return {
        "disponible":     True,
        "n_proyectos":    int(len(df)),
        "fecha_min":      fecha_min.strftime("%Y-%m") if pd.notna(fecha_min) else None,
        "fecha_max":      fecha_max.strftime("%Y-%m") if pd.notna(fecha_max) else None,
        "xlsx_bytes":     XLSX.stat().st_size,
        "por_categoria":  por_cat,
        "proyectos":      proyectos,
        "modelo_r2":      round(_modelo_b["r2"],  4) if _modelo_b else None,
        "modelo_r2a":     round(_modelo_b["r2a"], 4) if _modelo_b else None,
        "modelo_n":       _modelo_b["n"] if _modelo_b else None,
    }


def comparacion(meta_delta: float = 0.008) -> dict:
    """Compara utilidad media histórica (baseline) vs período reciente (2026)."""
    if _df is None:
        raise RuntimeError("Datos no disponibles.")

    df = _df.copy()
    tiene_fecha = df["Fecha de finalización"].notna().any()

    if tiene_fecha:
        df_base   = df[df["Fecha de finalización"].dt.year < 2026]
        df_q1     = df[(df["Fecha de finalización"].dt.year == 2026) &
                       (df["Fecha de finalización"].dt.quarter == 1)]
        df_actual = df_q1 if len(df_q1) > 0 else df[df["Fecha de finalización"].dt.year == 2026]
        periodo_label = "Q1 2026" if len(df_q1) > 0 else "2026"
    else:
        n = len(df)
        df_base   = df.iloc[:int(n * 0.8)]
        df_actual = df.iloc[int(n * 0.8):]
        periodo_label = "Período reciente (20% más nuevo)"

    if len(df_base) == 0 or len(df_actual) == 0:
        raise RuntimeError("No hay suficientes datos para comparar períodos.")

    media_base   = float(df_base["Utilidad del proyecto"].mean())
    media_actual = float(df_actual["Utilidad del proyecto"].mean())
    delta        = media_actual - media_base
    cumple       = delta >= meta_delta
    semaforo     = "VERDE" if cumple else ("AMARILLO" if delta >= 0 else "ROJO")

    proyectos = []
    for _, row in df_actual.iterrows():
        fecha = row["Fecha de finalización"]
        proyectos.append({
            "categoria":   str(row["Cat"]),
            "utilidad_pct": f"{row['Utilidad del proyecto']:.1%}",
            "utilidad_v":   round(float(row["Utilidad del proyecto"]), 4),
            "fecha": fecha.strftime("%Y-%m") if pd.notna(fecha) else None,
        })

    return {
        "baseline": {
            "label":     "Histórico (antes de 2026)",
            "media":     round(media_base, 4),
            "media_pct": f"{media_base:.1%}",
            "n":         int(len(df_base)),
        },
        "actual": {
            "label":     periodo_label,
            "media":     round(media_actual, 4),
            "media_pct": f"{media_actual:.1%}",
            "n":         int(len(df_actual)),
            "proyectos": proyectos,
        },
        "delta":       round(delta, 4),
        "delta_pct":   f"{delta:+.1%}",
        "meta_delta":  meta_delta,
        "meta_pct":    f"{meta_delta:+.1%}",
        "cumple_meta": cumple,
        "semaforo":    semaforo,
    }


def status() -> dict:
    return {
        "xlsx_disponible": XLSX.exists(),
        "modelo_b":        _modelo_b is not None,
        "n_proyectos":     int(_df.shape[0]) if _df is not None else 0,
        "n_categorias":    len(_cats_validas),
        "categorias":      _cats_validas,
    }
