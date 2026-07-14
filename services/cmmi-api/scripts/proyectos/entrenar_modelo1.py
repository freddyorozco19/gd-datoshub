"""
entrenar_modelo1.py
===================
Entrena el Modelo 1: P(SPI < 0.9 en el mes actual)

Entrada : datos de proyectos en formato Excel (mismo que el análisis histórico)
Salida  : modelo1_params.pkl  — parámetros del modelo listos para inferencia
           modelo1_metadata.json — métricas de validación y mapas de codificación

Uso:
    python entrenar_modelo1.py --datos Indicadores_Proyectos.xlsx
    python entrenar_modelo1.py --datos Indicadores_Proyectos.xlsx --umbral 0.40 --salida mi_modelo1.pkl
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
    confusion_matrix, classification_report
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

warnings.filterwarnings("ignore")

# ── Constantes ────────────────────────────────────────────────────────────────
FEATURES = [
    "mes_rel",     # posición relativa en el ciclo de vida [0, 1]
    "SPI_lag1",    # SPI del mes anterior
    "VRA_lag1",    # Variación Relativa de Avance del mes anterior
    "SPI_lag2",    # SPI de hace 2 meses
    "SPI_trend",   # SPI_lag1 − SPI_lag2  (dirección del cambio)
    "VRA_trend",   # VRA_lag1 − VRA_lag2  (dirección del cambio)
    "port_enc",    # portafolio codificado (entero)
    "lider_enc",   # líder codificado (entero)
]
SPI_THRESHOLD   = 0.9      # umbral de alerta en SPI
ALERT_THRESHOLD = 0.40     # probabilidad mínima para activar alerta
CV_FOLDS        = 5


# ── Carga y preparación de datos ──────────────────────────────────────────────
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
    print(f"    {len(df)} observaciones · {df['ProjectId'].nunique()} proyectos · "
          f"{df['portafolio'].nunique()} portafolios")
    return df


def construir_features(df: pd.DataFrame) -> pd.DataFrame:
    print("[2/5] Construyendo features con rezagos y tendencias")
    df = df.sort_values(["ProjectId", "mes_rel"]).copy()

    # Rezagos temporales por proyecto
    df["SPI_lag1"]  = df.groupby("ProjectId")["SPI"].shift(1)
    df["VRA_lag1"]  = df.groupby("ProjectId")["VRA"].shift(1)
    df["SPI_lag2"]  = df.groupby("ProjectId")["SPI"].shift(2)
    df["VRA_lag2"]  = df.groupby("ProjectId")["VRA"].shift(2)

    # Tendencias (delta entre meses consecutivos)
    df["SPI_trend"] = df["SPI_lag1"] - df["SPI_lag2"]
    df["VRA_trend"] = df["VRA_lag1"] - df["VRA_lag2"]

    # Codificación de categorías
    port_map   = {v: i for i, v in enumerate(sorted(df["portafolio"].unique()))}
    lider_map  = {v: i for i, v in enumerate(sorted(df["lider"].unique()))}
    df["port_enc"]  = df["portafolio"].map(port_map)
    df["lider_enc"] = df["lider"].map(lider_map)

    # Target
    df["target_M1"] = (df["SPI"] < SPI_THRESHOLD).astype(int)

    # Descartar filas sin SPI_lag1 (primer mes de cada proyecto)
    df = df.dropna(subset=["SPI_lag1", "VRA_lag1"])

    # Imputar SPI_lag2 y tendencias con la mediana cuando falten (mes 2)
    for col in ["SPI_lag2", "SPI_trend", "VRA_trend"]:
        df[col] = df[col].fillna(df[col].median())

    print(f"    {len(df)} observaciones utilizables")
    print(f"    Tasa de alertas (SPI < {SPI_THRESHOLD}): "
          f"{df['target_M1'].mean():.1%}  ({df['target_M1'].sum()} positivos)")

    return df, port_map, lider_map


# ── Entrenamiento y validación cruzada ───────────────────────────────────────
def entrenar_y_validar(df: pd.DataFrame, umbral: float) -> tuple:
    print(f"[3/5] Entrenando con validación cruzada {CV_FOLDS}-fold")

    X = df[FEATURES].values
    y = df["target_M1"].values

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(
            class_weight="balanced",
            max_iter=1000,
            random_state=42,
            solver="lbfgs",
        )),
    ])

    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)
    probs = cross_val_predict(pipeline, X, y, cv=cv, method="predict_proba")[:, 1]
    preds = (probs >= umbral).astype(int)

    auc    = roc_auc_score(y, probs)
    brier  = brier_score_loss(y, probs)
    tn, fp, fn, tp = confusion_matrix(y, preds).ravel()
    prec   = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec    = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1     = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
    fpr    = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    print(f"    AUC-ROC  : {auc:.4f}")
    print(f"    Brier    : {brier:.4f}  (0 = perfecto, 0.25 = aleatorio)")
    print(f"    Precisión: {prec:.3f}  |  Recall: {rec:.3f}  |  F1: {f1:.3f}")
    print(f"    TP={tp}  FP={fp}  FN={fn}  TN={tn}  |  FPR={fpr:.3f}")

    metricas = dict(
        auc=round(auc, 4), brier=round(brier, 4),
        precision=round(prec, 3), recall=round(rec, 3),
        f1=round(f1, 3), fpr=round(fpr, 3),
        tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn),
        n_obs=int(len(y)), n_positivos=int(y.sum()),
        umbral_alerta=umbral,
        spi_threshold=SPI_THRESHOLD,
    )

    # Entrenamiento final sobre todos los datos
    pipeline.fit(X, y)

    # Importancia de variables (coeficientes)
    coefs = pipeline.named_steps["clf"].coef_[0]
    importancia = {f: round(float(c), 4) for f, c in zip(FEATURES, coefs)}
    print("\n    Importancia de variables (coeficientes logísticos):")
    for f, c in sorted(importancia.items(), key=lambda x: abs(x[1]), reverse=True):
        bar = "█" * int(abs(c) * 5)
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
        "descripcion":  "Modelo 1: P(SPI < 0.9 en el mes actual)",
    }

    with open(ruta_pkl, "wb") as f:
        pickle.dump(artefacto, f)

    metadata = {
        "modelo":      "Modelo 1 — Alerta mensual SPI",
        "target":      f"SPI < {SPI_THRESHOLD}",
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
        description="Entrena el Modelo 1: alerta mensual de SPI"
    )
    parser.add_argument(
        "--datos", required=True,
        help="Ruta al archivo Excel con los indicadores de proyectos"
    )
    parser.add_argument(
        "--umbral", type=float, default=ALERT_THRESHOLD,
        help=f"Umbral de probabilidad para activar alerta (default: {ALERT_THRESHOLD})"
    )
    parser.add_argument(
        "--salida", default="modelo1_params.pkl",
        help="Nombre del archivo de salida .pkl (default: modelo1_params.pkl)"
    )
    args = parser.parse_args()

    ruta_json = Path(args.salida).stem + "_metadata.json"

    print("=" * 60)
    print("  ENTRENAMIENTO — MODELO 1: Alerta mensual SPI")
    print("=" * 60)

    df_raw                      = cargar_datos(args.datos)
    df_feat, port_map, lider_map = construir_features(df_raw)
    pipeline, metricas, imp     = entrenar_y_validar(df_feat, args.umbral)
    guardar_modelo(pipeline, metricas, imp, port_map, lider_map,
                   args.salida, ruta_json)

    print("\n[5/5] Entrenamiento completado exitosamente")
    print(f"    AUC-ROC: {metricas['auc']}  |  "
          f"Precisión: {metricas['precision']}  |  "
          f"Recall: {metricas['recall']}")
    print(f"\n  Para correr el modelo:")
    print(f"    python correr_modelo1.py --modelo {args.salida} "
          f"--portafolio \"TI\" --lider \"Carlos Osorio\" "
          f"--mes_rel 0.35 --SPI_lag1 0.93 --VRA_lag1 -0.07")
    print("=" * 60)


if __name__ == "__main__":
    main()
