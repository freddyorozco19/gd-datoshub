"""
entrenar_modelo_kickoff.py
==========================
Entrena el Modelo 0 (Kickoff): P(el proyecto alcanzará SPI < 0.85)
usando SOLO variables disponibles en el momento de inicio del proyecto.

IMPORTANTE — LIMITACIONES CONOCIDAS:
  - AUC-ROC ~0.56-0.61 (marginalmente mejor que azar)
  - Precisión ~41-45% con umbral recomendado (muchas falsas alarmas)
  - La señal principal es la duración del proyecto y el portafolio
  - Sin datos de ejecución, el modelo sirve como "prior bayesiano":
    establece una probabilidad inicial que se actualiza con el Modelo 2
    en cuanto llega el primer reporte mensual de SPI
  - NO reemplaza al Modelo 2; es un complemento para el kickoff literal

Variables disponibles en kickoff (sin ejecución):
  - portafolio
  - líder del proyecto
  - duración planificada (Meses)
  - presupuesto

Salida:
  - modelo_kickoff_params.pkl
  - modelo_kickoff_metadata.json

Uso:
    python entrenar_modelo_kickoff.py --datos Indicadores_Proyectos.xlsx
    python entrenar_modelo_kickoff.py --datos Indicadores_Proyectos.xlsx --umbral 0.30
"""

import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    roc_auc_score, brier_score_loss, confusion_matrix
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict

warnings.filterwarnings("ignore")

# ── Constantes ────────────────────────────────────────────────────────────────
FEATURES = [
    "port_enc",          # portafolio codificado
    "lider_enc",         # líder codificado
    "duracion_meses",    # duración planificada total
    "log_presupuesto",   # log(presupuesto + 1) — normaliza la distribución sesgada
    "dur_corto",         # bandera: duración <= 3 meses
    "dur_mediano",       # bandera: 3 < duración <= 12 meses
    "dur_largo",         # bandera: duración > 12 meses
]
SPI_MIN_THRESHOLD = 0.85
ALERT_THRESHOLD   = 0.30   # umbral más bajo que M1/M2 por menor precisión del modelo
CV_FOLDS          = 5

ADVERTENCIA = """
╔══════════════════════════════════════════════════════════════╗
║  MODELO KICKOFF — LIMITACIONES IMPORTANTES                   ║
║  AUC ~0.56: marginalmente por encima del azar (0.50)         ║
║  FPR alto: ~70% de falsas alarmas al umbral recomendado      ║
║  Uso recomendado: prior bayesiano en kickoff, reemplazar      ║
║  con Modelo 2 en cuanto llegue el primer reporte de SPI      ║
╚══════════════════════════════════════════════════════════════╝"""


# ── Carga y preparación ───────────────────────────────────────────────────────
def cargar_datos(ruta: str) -> pd.DataFrame:
    print(f"[1/5] Cargando datos desde: {ruta}")
    df = pd.read_excel(ruta)
    df = df.rename(columns={
        "Mes Relativo":                       "mes_rel",
        "SPI (Schedule Performance Index)":   "SPI",
        "Portafolio":                          "portafolio",
        "ProjectOwnerName":                    "lider",
        "Meses":                               "duracion_meses",
        "Presupuesto":                         "presupuesto",
    })

    # Agregar a nivel de proyecto — solo variables disponibles en kickoff
    proj = df.groupby("ProjectId").agg(
        lider=("lider", "first"),
        portafolio=("portafolio", "first"),
        duracion_meses=("duracion_meses", "first"),
        presupuesto=("presupuesto", "first"),
        SPI_min=("SPI", "min"),
    ).reset_index()

    print(f"    {len(proj)} proyectos  |  "
          f"{proj['portafolio'].nunique()} portafolios  |  "
          f"{proj['lider'].nunique()} líderes")
    return proj


def construir_features(proj: pd.DataFrame) -> tuple:
    print("[2/5] Construyendo features de kickoff")

    # Codificaciones categóricas
    port_map  = {v: i for i, v in enumerate(sorted(proj["portafolio"].unique()))}
    lider_map = {v: i for i, v in enumerate(sorted(proj["lider"].unique()))}
    proj["port_enc"]  = proj["portafolio"].map(port_map)
    proj["lider_enc"] = proj["lider"].map(lider_map)

    # Presupuesto: log-transformado para manejar distribución altamente sesgada
    presupuesto_median = float(proj["presupuesto"].median())
    proj["log_presupuesto"] = np.log1p(
        proj["presupuesto"].fillna(presupuesto_median)
    )

    # Categorías de duración (las más predictivas según análisis)
    proj["dur_corto"]   = (proj["duracion_meses"] <= 3).astype(int)
    proj["dur_mediano"]  = (
        (proj["duracion_meses"] > 3) & (proj["duracion_meses"] <= 12)
    ).astype(int)
    proj["dur_largo"]    = (proj["duracion_meses"] > 12).astype(int)

    # Target
    proj["target"] = (proj["SPI_min"] < SPI_MIN_THRESHOLD).astype(int)

    n_pos = proj["target"].sum()
    print(f"    Proyectos en riesgo (SPI_min < {SPI_MIN_THRESHOLD}): "
          f"{n_pos}/{len(proj)} = {n_pos/len(proj):.1%}")

    # Tabla de tasas históricas por segmento (lookup sin modelo)
    proj["dur_cat"] = pd.cut(
        proj["duracion_meses"], bins=[0, 3, 12, 1000],
        labels=["corto (<=3m)", "mediano (3-12m)", "largo (>12m)"]
    )
    lookup = (
        proj.groupby(["portafolio", "dur_cat"], observed=True)["target"]
        .agg(n_riesgo="sum", n_total="count", tasa_riesgo="mean")
        .reset_index()
    )
    print("\n    Tasas históricas de riesgo por portafolio y duración:")
    print("    " + lookup.to_string(index=False).replace("\n", "\n    "))

    return proj, port_map, lider_map, presupuesto_median, lookup


# ── Entrenamiento ─────────────────────────────────────────────────────────────
def entrenar_y_validar(proj: pd.DataFrame, umbral: float) -> tuple:
    print(f"\n[3/5] Entrenando Random Forest con validación cruzada {CV_FOLDS}-fold")
    print(ADVERTENCIA)

    X = proj[FEATURES].fillna(0).values
    y = proj["target"].values

    modelo = RandomForestClassifier(
        n_estimators=300,
        max_depth=4,
        min_samples_leaf=3,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    cv    = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)
    probs = cross_val_predict(modelo, X, y, cv=cv, method="predict_proba")[:, 1]

    auc   = roc_auc_score(y, probs)
    brier = brier_score_loss(y, probs)
    preds = (probs >= umbral).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, preds).ravel()
    prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    rec  = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1   = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
    fpr  = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    print(f"\n    AUC-ROC  : {auc:.4f}  ← comparar con base rate {y.mean():.3f}")
    print(f"    Brier    : {brier:.4f}")
    print(f"    Precisión: {prec:.3f}  |  Recall: {rec:.3f}  |  F1: {f1:.3f}")
    print(f"    TP={tp}  FP={fp}  FN={fn}  TN={tn}  |  FPR={fpr:.3f}")
    print(f"\n    [!] FPR de {fpr:.1%}: de cada 10 proyectos sanos, "
          f"{int(round(fpr*10))} recibirán falsa alarma.")

    print("\n    Análisis de umbrales:")
    print(f"    {'Umbral':>8} {'Prec':>7} {'Recall':>8} {'F1':>6} "
          f"{'FPR':>6} {'TP':>5} {'FP':>5} {'FN':>5}")
    for t in [0.25, 0.30, 0.35, 0.40, 0.45, 0.50]:
        p2 = (probs >= t).astype(int)
        tn2, fp2, fn2, tp2 = confusion_matrix(y, p2).ravel()
        pr2 = tp2 / (tp2 + fp2) if tp2 + fp2 > 0 else 0
        re2 = tp2 / (tp2 + fn2) if tp2 + fn2 > 0 else 0
        f2  = 2 * pr2 * re2 / (pr2 + re2) if pr2 + re2 > 0 else 0
        fp2r = fp2 / (fp2 + tn2) if fp2 + tn2 > 0 else 0
        mark = "  ← recomendado" if abs(t - umbral) < 0.01 else ""
        print(f"    {t:>8.2f} {pr2:>7.3f} {re2:>8.3f} {f2:>6.3f} "
              f"{fp2r:>6.3f} {tp2:>5} {fp2:>5} {fn2:>5}{mark}")

    metricas = dict(
        auc=round(auc, 4), brier=round(brier, 4),
        precision=round(prec, 3), recall=round(rec, 3),
        f1=round(f1, 3), fpr=round(fpr, 3),
        tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn),
        base_rate=round(float(y.mean()), 4),
        n_proyectos=int(len(y)),
        n_riesgo=int(y.sum()),
        umbral_alerta=umbral,
        spi_min_threshold=SPI_MIN_THRESHOLD,
        advertencia=(
            f"AUC {auc:.2f}: modelo débil. Usar como prior bayesiano. "
            f"FPR {fpr:.0%} al umbral {umbral}."
        ),
    )

    # Importancias
    modelo.fit(X, y)
    importancia = {
        f: round(float(imp), 4)
        for f, imp in zip(FEATURES, modelo.feature_importances_)
    }
    print("\n    Importancia de variables:")
    for f, imp in sorted(importancia.items(), key=lambda x: x[1], reverse=True):
        bar = "█" * int(imp * 40)
        print(f"      {f:25s}: {imp:.4f}  {bar}")

    return modelo, metricas, importancia


# ── Guardar artefactos ────────────────────────────────────────────────────────
def guardar_modelo(modelo, metricas, importancia,
                   port_map, lider_map, presupuesto_median, lookup,
                   ruta_pkl: str, ruta_json: str):
    print(f"\n[4/5] Guardando modelo en: {ruta_pkl}")

    artefacto = {
        "modelo":              modelo,
        "features":            FEATURES,
        "port_map":            port_map,
        "lider_map":           lider_map,
        "presupuesto_median":  presupuesto_median,
        "metricas":            metricas,
        "importancia":         importancia,
        "lookup":              lookup.to_dict(orient="records"),
        "version":             "1.0",
        "descripcion":         (
            f"Modelo Kickoff: P(SPI_min < {SPI_MIN_THRESHOLD}) "
            f"usando solo variables de inicio de proyecto. "
            f"AUC {metricas['auc']} — prior bayesiano."
        ),
    }
    with open(ruta_pkl, "wb") as f:
        pickle.dump(artefacto, f)

    metadata = {
        "modelo":         "Modelo Kickoff — Prior bayesiano",
        "target":         f"SPI_min < {SPI_MIN_THRESHOLD}",
        "tipo":           "Random Forest (n=300, max_depth=4, balanced)",
        "features":       FEATURES,
        "metricas_cv":    metricas,
        "importancia":    importancia,
        "encodings":      {"portafolio": port_map, "lider": lider_map},
        "lookup_riesgo":  [
            {k: (str(v) if hasattr(v, 'item') else v)
             for k, v in row.items()} for row in lookup.to_dict("records")
        ],
        "advertencias": [
            f"AUC {metricas['auc']} es marginalmente mejor que azar (0.50)",
            f"FPR {metricas['fpr']} al umbral {metricas['umbral_alerta']}: muchas falsas alarmas",
            "Reemplazar con Modelo 2 al llegar el primer reporte mensual de SPI",
            "La duración del proyecto es el feature más predictivo (38% importancia)",
            "Proyectos largos (>12m) tienen históricamente solo 11.8% de tasa de riesgo",
        ],
    }
    with open(ruta_json, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"    Metadata guardada en: {ruta_json}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Entrena el Modelo Kickoff: riesgo en inicio del proyecto"
    )
    parser.add_argument(
        "--datos", required=True,
        help="Ruta al archivo Excel con los indicadores de proyectos"
    )
    parser.add_argument(
        "--umbral", type=float, default=ALERT_THRESHOLD,
        help=f"Umbral de probabilidad (default: {ALERT_THRESHOLD}). "
             f"Más bajo que M1/M2 por la menor precisión del modelo."
    )
    parser.add_argument(
        "--salida", default="modelo_kickoff_params.pkl",
        help="Nombre del archivo de salida .pkl"
    )
    args = parser.parse_args()

    ruta_json = Path(args.salida).stem + "_metadata.json"

    print("=" * 62)
    print("  ENTRENAMIENTO — MODELO KICKOFF (prior bayesiano)")
    print("=" * 62)

    proj_raw                               = cargar_datos(args.datos)
    proj_feat, port_map, lider_map, p_med, lookup = construir_features(proj_raw)
    modelo, metricas, imp                  = entrenar_y_validar(proj_feat, args.umbral)
    guardar_modelo(modelo, metricas, imp,
                   port_map, lider_map, p_med, lookup,
                   args.salida, ruta_json)

    print("\n[5/5] Entrenamiento completado")
    print(f"    AUC: {metricas['auc']}  |  Recall: {metricas['recall']}  "
          f"|  Umbral: {metricas['umbral_alerta']}")
    print(f"\n  Para correr el modelo:")
    print(f"    python correr_modelo_kickoff.py --modelo {args.salida} "
          f'--portafolio "TI" --lider "Carlos Osorio" '
          f"--duracion_meses 8 --presupuesto 950000000")
    print("=" * 62)


if __name__ == "__main__":
    main()
