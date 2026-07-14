"""
entrenar_modelo2.py
===================
Entrena el Modelo 2: P(el proyecto alcanzará SPI < 0.85 en algún momento)

Este modelo se alimenta con los primeros meses de un proyecto nuevo
y estima la probabilidad de que el proyecto experimente deterioro severo.

Entrada : datos de proyectos en formato Excel
Salida  : modelo2_params.pkl  — parámetros del modelo
           modelo2_metadata.json — métricas de validación y mapas de codificación

Uso:
    python entrenar_modelo2.py --datos Indicadores_Proyectos.xlsx
    python entrenar_modelo2.py --datos Indicadores_Proyectos.xlsx --meses_hist 3 --umbral 0.40
"""

import argparse
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pickle
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    roc_auc_score, brier_score_loss,
    confusion_matrix
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ── Constantes ────────────────────────────────────────────────────────────────
FEATURES = [
    "mes_rel",
    "SPI_lag1",
    "VRA_lag1",
    "SPI_lag2",
    "SPI_trend",
    "VRA_trend",
    "port_enc",
    "lider_enc",
]
SPI_MIN_THRESHOLD = 0.85   # SPI mínimo que define "proyecto en riesgo"
ALERT_THRESHOLD   = 0.40   # probabilidad para clasificar como riesgo alto
MESES_HISTORIA    = 3      # cuántos meses iniciales usar para entrenar/predecir
CV_FOLDS          = 5


# ── Carga y preparación ───────────────────────────────────────────────────────
def cargar_datos(ruta: str) -> pd.DataFrame:
    print(f"[1/5] Cargando datos desde: {ruta}")
    df = pd.read_excel(ruta)
    df = df.rename(columns={
        "Mes Relativo":                       "mes_rel",
        "SPI (Schedule Performance Index)":   "SPI",
        "Variación Relativa Avance":           "VRA",
        "Portafolio":                          "portafolio",
        "ProjectOwnerName":                    "lider",
    })
    df = df.dropna(subset=["SPI", "VRA"])
    print(f"    {len(df)} observaciones · {df['ProjectId'].nunique()} proyectos")
    return df


def construir_features(df: pd.DataFrame, meses_historia: int) -> pd.DataFrame:
    print(f"[2/5] Construyendo features — usando los primeros {meses_historia} meses por proyecto")
    df = df.sort_values(["ProjectId", "mes_rel"]).copy()

    # Rezagos y tendencias
    df["SPI_lag1"]  = df.groupby("ProjectId")["SPI"].shift(1)
    df["VRA_lag1"]  = df.groupby("ProjectId")["VRA"].shift(1)
    df["SPI_lag2"]  = df.groupby("ProjectId")["SPI"].shift(2)
    df["VRA_lag2"]  = df.groupby("ProjectId")["VRA"].shift(2)
    df["SPI_trend"] = df["SPI_lag1"] - df["SPI_lag2"]
    df["VRA_trend"] = df["VRA_lag1"] - df["VRA_lag2"]

    # Codificación
    port_map  = {v: i for i, v in enumerate(sorted(df["portafolio"].unique()))}
    lider_map = {v: i for i, v in enumerate(sorted(df["lider"].unique()))}
    df["port_enc"]  = df["portafolio"].map(port_map)
    df["lider_enc"] = df["lider"].map(lider_map)

    # Target a nivel de proyecto: ¿llegó alguna vez a SPI < threshold?
    spi_min = (
        df.groupby("ProjectId")["SPI"]
        .min()
        .reset_index()
        .rename(columns={"SPI": "SPI_min"})
    )
    df = df.merge(spi_min, on="ProjectId")
    df["target_M2"] = (df["SPI_min"] < SPI_MIN_THRESHOLD).astype(int)

    # Retener solo los primeros N meses de cada proyecto
    df = df.groupby("ProjectId").head(meses_historia)

    # Descartar filas sin rezago disponible
    df = df.dropna(subset=["SPI_lag1", "VRA_lag1"])

    # Imputar con mediana cuando SPI_lag2 / tendencias no estén disponibles
    for col in ["SPI_lag2", "SPI_trend", "VRA_trend"]:
        df[col] = df[col].fillna(df[col].median())

    n_proyectos = df["ProjectId"].nunique()
    n_riesgo    = df.drop_duplicates("ProjectId")["target_M2"].sum()
    print(f"    {len(df)} observaciones de entrenamiento · {n_proyectos} proyectos")
    print(f"    Proyectos que alcanzaron SPI < {SPI_MIN_THRESHOLD}: "
          f"{n_riesgo} / {n_proyectos}  ({n_riesgo/n_proyectos:.1%})")

    return df, port_map, lider_map


# ── Entrenamiento y validación ────────────────────────────────────────────────
def entrenar_y_validar(df: pd.DataFrame, umbral: float) -> tuple:
    print(f"[3/5] Entrenando con validación cruzada {CV_FOLDS}-fold")

    X = df[FEATURES].values
    y = df["target_M2"].values

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=42,
            solver="lbfgs",
        )),
    ])

    cv    = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)
    probs = cross_val_predict(pipeline, X, y, cv=cv, method="predict_proba")[:, 1]
    preds = (probs >= umbral).astype(int)

    auc   = roc_auc_score(y, probs)
    brier = brier_score_loss(y, probs)
    tn, fp, fn, tp = confusion_matrix(y, preds).ravel()
    prec  = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec   = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1    = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
    fpr   = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    print(f"    AUC-ROC  : {auc:.4f}")
    print(f"    Brier    : {brier:.4f}")
    print(f"    Precisión: {prec:.3f}  |  Recall: {rec:.3f}  |  F1: {f1:.3f}")
    print(f"    TP={tp}  FP={fp}  FN={fn}  TN={tn}  |  FPR={fpr:.3f}")

    # Análisis por umbral
    print("\n    Análisis de umbrales:")
    print(f"    {'Umbral':>8} {'Prec':>7} {'Recall':>8} {'F1':>6} {'FPR':>6} {'TP':>5} {'FP':>5} {'FN':>5}")
    for t in [0.20, 0.30, 0.40, 0.50]:
        p2 = (probs >= t).astype(int)
        tn2, fp2, fn2, tp2 = confusion_matrix(y, p2).ravel()
        pr2 = tp2 / (tp2 + fp2) if (tp2 + fp2) > 0 else 0
        re2 = tp2 / (tp2 + fn2) if (tp2 + fn2) > 0 else 0
        f2  = 2 * pr2 * re2 / (pr2 + re2) if (pr2 + re2) > 0 else 0
        fp2r = fp2 / (fp2 + tn2) if (fp2 + tn2) > 0 else 0
        mark = "  ← recomendado" if abs(t - umbral) < 0.01 else ""
        print(f"    {t:>8.2f} {pr2:>7.3f} {re2:>8.3f} {f2:>6.3f} {fp2r:>6.3f} "
              f"{tp2:>5} {fp2:>5} {fn2:>5}{mark}")

    metricas = dict(
        auc=round(auc, 4), brier=round(brier, 4),
        precision=round(prec, 3), recall=round(rec, 3),
        f1=round(f1, 3), fpr=round(fpr, 3),
        tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn),
        n_obs=int(len(y)),
        n_proyectos_riesgo=int(y.sum()),
        umbral_alerta=umbral,
        spi_min_threshold=SPI_MIN_THRESHOLD,
        meses_historia=MESES_HISTORIA,
    )

    # Entrenamiento final
    pipeline.fit(X, y)

    coefs       = pipeline.named_steps["clf"].coef_[0]
    importancia = {f: round(float(c), 4) for f, c in zip(FEATURES, coefs)}

    print("\n    Importancia de variables (coeficientes logísticos):")
    for f, c in sorted(importancia.items(), key=lambda x: abs(x[1]), reverse=True):
        bar  = "█" * int(abs(c) * 5)
        sign = "+" if c >= 0 else "−"
        print(f"      {f:20s} {sign}{abs(c):.4f}  {bar}")

    return pipeline, metricas, importancia


# ── Guardar artefactos ────────────────────────────────────────────────────────
def guardar_modelo(pipeline, metricas, importancia, port_map, lider_map,
                   ruta_pkl: str, ruta_json: str):
    print(f"\n[4/5] Guardando modelo en: {ruta_pkl}")

    artefacto = {
        "modelo":       pipeline,
        "features":     FEATURES,
        "port_map":     port_map,
        "lider_map":    lider_map,
        "metricas":     metricas,
        "importancia":  importancia,
        "version":      "1.0",
        "descripcion":  f"Modelo 2: P(min SPI < {SPI_MIN_THRESHOLD} a lo largo del proyecto)",
    }

    with open(ruta_pkl, "wb") as f:
        pickle.dump(artefacto, f)

    metadata = {
        "modelo":      "Modelo 2 — Riesgo de proyecto",
        "target":      f"SPI_min < {SPI_MIN_THRESHOLD}",
        "features":    FEATURES,
        "metricas_cv": metricas,
        "importancia": importancia,
        "encodings": {
            "portafolio": port_map,
            "lider":      lider_map,
        },
    }

    with open(ruta_json, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"    Metadata guardada en: {ruta_json}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Entrena el Modelo 2: riesgo de SPI mínimo a nivel de proyecto"
    )
    parser.add_argument(
        "--datos", required=True,
        help="Ruta al archivo Excel con los indicadores de proyectos"
    )
    parser.add_argument(
        "--meses_hist", type=int, default=MESES_HISTORIA,
        help=f"Primeros N meses a usar por proyecto (default: {MESES_HISTORIA})"
    )
    parser.add_argument(
        "--umbral", type=float, default=ALERT_THRESHOLD,
        help=f"Umbral de probabilidad para clasificar riesgo alto (default: {ALERT_THRESHOLD})"
    )
    parser.add_argument(
        "--salida", default="modelo2_params.pkl",
        help="Nombre del archivo de salida .pkl (default: modelo2_params.pkl)"
    )
    args = parser.parse_args()

    ruta_json = Path(args.salida).stem + "_metadata.json"

    print("=" * 60)
    print("  ENTRENAMIENTO — MODELO 2: Riesgo de proyecto")
    print("=" * 60)

    df_raw                       = cargar_datos(args.datos)
    df_feat, port_map, lider_map = construir_features(df_raw, args.meses_hist)
    pipeline, metricas, imp      = entrenar_y_validar(df_feat, args.umbral)
    guardar_modelo(pipeline, metricas, imp, port_map, lider_map,
                   args.salida, ruta_json)

    print("\n[5/5] Entrenamiento completado exitosamente")
    print(f"    AUC-ROC: {metricas['auc']}  |  "
          f"Precisión: {metricas['precision']}  |  "
          f"Recall: {metricas['recall']}")
    print(f"\n  Para correr el modelo:")
    print(f"    python correr_modelo2.py --modelo {args.salida} "
          f"--portafolio \"TI\" --lider \"Carlos Osorio\" "
          f"--mes_rel 0.12 --SPI_lag1 0.92 --VRA_lag1 -0.08")
    print("=" * 60)


if __name__ == "__main__":
    main()
