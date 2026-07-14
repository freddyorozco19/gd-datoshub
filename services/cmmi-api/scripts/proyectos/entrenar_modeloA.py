"""
entrenar_modeloA.py
===================
Entrena el Modelo A: P(el proyecto NO completara el 100% de su alcance)

Este modelo opera en el kickoff del proyecto, usando solo variables
disponibles antes de iniciar la ejecucion:
  - portafolio, lider, duracion planificada, presupuesto

Target: pct_real_final < 0.95 (el proyecto cierra con alcance incompleto)
        36.5% de proyectos historicos no alcanzaron el 95% de completado.

Algoritmo: Random Forest (AUC 0.82 en CV 5-fold)
           Significativamente mejor que el Modelo Kickoff de SPI (AUC 0.56)

Complemento al Modelo Kickoff:
  Modelo Kickoff → P(SPI se deteriorara)       = perspectiva de CRONOGRAMA
  Modelo A       → P(alcance quedara incompleto) = perspectiva de ALCANCE

Salida:
  modeloA_params.pkl
  modeloA_metadata.json

Uso:
    python entrenar_modeloA.py --datos Indicadores_Proyectos.xlsx
    python entrenar_modeloA.py --datos Indicadores_Proyectos.xlsx --umbral 0.40
"""

import argparse
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, brier_score_loss, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_predict

warnings.filterwarnings("ignore")

# ── Constantes ────────────────────────────────────────────────────────────────
FEATURES = [
    "port_enc",          # portafolio codificado
    "lider_enc",         # lider codificado
    "duracion_meses",    # duracion planificada total
    "log_presupuesto",   # log(presupuesto + 1)
    "dur_corto",         # bandera: duracion <= 3 meses
    "dur_mediano",       # bandera: 3 < duracion <= 12 meses
    "dur_largo",         # bandera: duracion > 12 meses
]
COMPLETADO_THRESHOLD = 0.95  # umbral para considerar "no completado"
ALERT_THRESHOLD      = 0.40  # umbral de probabilidad para activar alerta
CV_FOLDS             = 5


# ── Carga ─────────────────────────────────────────────────────────────────────
def cargar_datos(ruta: str) -> pd.DataFrame:
    print(f"[1/5] Cargando datos desde: {ruta}")
    df = pd.read_excel(ruta)
    df = df.rename(columns={
        "Mes Relativo":                       "mes_rel",
        "SPI (Schedule Performance Index)":   "SPI",
        "Completado Real":                    "pct_real",
        "Portafolio":                          "portafolio",
        "ProjectOwnerName":                    "lider",
        "Meses":                               "duracion_meses",
        "Presupuesto":                         "presupuesto",
    })

    proj = df.groupby("ProjectId").agg(
        lider=("lider", "first"),
        portafolio=("portafolio", "first"),
        duracion_meses=("duracion_meses", "first"),
        presupuesto=("presupuesto", "first"),
        pct_real_final=("pct_real", "last"),
    ).reset_index()

    print(f"    {len(proj)} proyectos  |  "
          f"{proj['portafolio'].nunique()} portafolios  |  "
          f"{proj['lider'].nunique()} lideres")
    return proj


# ── Features ──────────────────────────────────────────────────────────────────
def construir_features(proj: pd.DataFrame) -> tuple:
    print("[2/5] Construyendo features de kickoff")

    port_map  = {v: i for i, v in enumerate(sorted(proj["portafolio"].unique()))}
    lider_map = {v: i for i, v in enumerate(sorted(proj["lider"].unique()))}
    proj["port_enc"]  = proj["portafolio"].map(port_map)
    proj["lider_enc"] = proj["lider"].map(lider_map)

    presupuesto_median = float(proj["presupuesto"].median())
    proj["log_presupuesto"] = np.log1p(
        proj["presupuesto"].fillna(presupuesto_median)
    )
    proj["dur_corto"]   = (proj["duracion_meses"] <= 3).astype(int)
    proj["dur_mediano"]  = (
        (proj["duracion_meses"] > 3) & (proj["duracion_meses"] <= 12)
    ).astype(int)
    proj["dur_largo"]   = (proj["duracion_meses"] > 12).astype(int)

    proj["target"] = (proj["pct_real_final"] < COMPLETADO_THRESHOLD).astype(int)

    n_pos = proj["target"].sum()
    print(f"    Proyectos con completado < {COMPLETADO_THRESHOLD:.0%}: "
          f"{n_pos}/{len(proj)} = {n_pos/len(proj):.1%}")
    print(f"    Distribucion completado final:")
    print(f"      Completado al 100%          : "
          f"{(proj['pct_real_final']==1.0).sum()} proyectos")
    print(f"      Completado >= 95% y < 100%  : "
          f"{((proj['pct_real_final']>=0.95)&(proj['pct_real_final']<1.0)).sum()} proyectos")
    print(f"      Completado >= 50% y < 95%   : "
          f"{((proj['pct_real_final']>=0.50)&(proj['pct_real_final']<0.95)).sum()} proyectos")
    print(f"      Completado < 50% (incompleto): "
          f"{(proj['pct_real_final']<0.50).sum()} proyectos")

    # Tabla de tasas historicas
    proj["dur_cat"] = pd.cut(
        proj["duracion_meses"], bins=[0, 3, 12, 1000],
        labels=["corto (<=3m)", "mediano (3-12m)", "largo (>12m)"]
    )
    lookup = (
        proj.groupby(["portafolio", "dur_cat"], observed=True)["target"]
        .agg(n_riesgo="sum", n_total="count", tasa_no_completado="mean")
        .reset_index()
    )
    print("\n    Tasas historicas de no-completado por portafolio y duracion:")
    print("    " + lookup.to_string(index=False).replace("\n", "\n    "))

    # Lideres con mayor tasa de no-completado (min 2 proyectos)
    lider_stats = (
        proj.groupby("lider")["target"]
        .agg(["sum", "count", "mean"])
        .query("count >= 2")
        .sort_values("mean", ascending=False)
    )
    print("\n    Lideres con mayor tasa de alcance incompleto (min 2 proyectos):")
    for lider, row in lider_stats.head(5).iterrows():
        print(f"      {lider[:40]:40s}: "
              f"{row['sum']:.0f}/{row['count']:.0f} = {row['mean']:.0%}")

    return proj, port_map, lider_map, presupuesto_median, lookup


# ── Entrenamiento ─────────────────────────────────────────────────────────────
def entrenar_y_validar(proj: pd.DataFrame, umbral: float) -> tuple:
    print(f"\n[3/5] Entrenando Random Forest con validacion cruzada {CV_FOLDS}-fold")

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

    print(f"    AUC-ROC  : {auc:.4f}  (base rate: {y.mean():.3f})")
    print(f"    Brier    : {brier:.4f}")
    print(f"    Precision: {prec:.3f}  |  Recall: {rec:.3f}  |  F1: {f1:.3f}")
    print(f"    TP={tp}  FP={fp}  FN={fn}  TN={tn}  |  FPR={fpr:.3f}")

    print("\n    Analisis de umbrales:")
    print(f"    {'Umbral':>8} {'Prec':>7} {'Recall':>8} {'F1':>6} "
          f"{'FPR':>6} {'TP':>5} {'FP':>5} {'FN':>5}")
    for t in [0.30, 0.35, 0.40, 0.45, 0.50, 0.55]:
        p2 = (probs >= t).astype(int)
        tn2, fp2, fn2, tp2 = confusion_matrix(y, p2).ravel()
        pr2 = tp2 / (tp2 + fp2) if tp2 + fp2 > 0 else 0
        re2 = tp2 / (tp2 + fn2) if tp2 + fn2 > 0 else 0
        f2  = 2 * pr2 * re2 / (pr2 + re2) if pr2 + re2 > 0 else 0
        fp2r = fp2 / (fp2 + tn2) if fp2 + tn2 > 0 else 0
        mark = "  <- recomendado" if abs(t - umbral) < 0.01 else ""
        print(f"    {t:>8.2f} {pr2:>7.3f} {re2:>8.3f} {f2:>6.3f} "
              f"{fp2r:>6.3f} {tp2:>5} {fp2:>5} {fn2:>5}{mark}")

    metricas = dict(
        auc=round(auc, 4), brier=round(brier, 4),
        precision=round(prec, 3), recall=round(rec, 3),
        f1=round(f1, 3), fpr=round(fpr, 3),
        tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn),
        base_rate=round(float(y.mean()), 4),
        n_proyectos=int(len(y)),
        n_no_completados=int(y.sum()),
        umbral_alerta=umbral,
        completado_threshold=COMPLETADO_THRESHOLD,
    )

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


# ── Guardar ───────────────────────────────────────────────────────────────────
def guardar_modelo(modelo, metricas, importancia,
                   port_map, lider_map, presupuesto_median, lookup,
                   ruta_pkl: str, ruta_json: str):
    print(f"\n[4/5] Guardando modelo en: {ruta_pkl}")

    artefacto = {
        "modelo":             modelo,
        "features":           FEATURES,
        "port_map":           port_map,
        "lider_map":          lider_map,
        "presupuesto_median": presupuesto_median,
        "metricas":           metricas,
        "importancia":        importancia,
        "lookup":             lookup.to_dict(orient="records"),
        "version":            "1.0",
        "descripcion": (
            f"Modelo A: P(pct_real_final < {COMPLETADO_THRESHOLD:.0%}) "
            f"— riesgo de alcance incompleto al cierre. "
            f"AUC {metricas['auc']}. Kickoff-ready."
        ),
    }
    with open(ruta_pkl, "wb") as f:
        pickle.dump(artefacto, f)

    metadata = {
        "modelo":         "Modelo A — Riesgo de alcance incompleto",
        "target":         f"pct_real_final < {COMPLETADO_THRESHOLD:.0%}",
        "tipo":           "Random Forest (n=300, max_depth=4, balanced)",
        "features":       FEATURES,
        "metricas_cv":    metricas,
        "importancia":    importancia,
        "encodings":      {"portafolio": port_map, "lider": lider_map},
        "lookup_riesgo":  [
            {k: (str(v) if hasattr(v, "item") else v) for k, v in row.items()}
            for row in lookup.to_dict("records")
        ],
        "notas": [
            "AUC 0.82 — modelo de kickoff significativamente mas util que el Modelo Kickoff de SPI (0.56)",
            "Perspectiva de ALCANCE — complementa al Modelo Kickoff que mide perspectiva de CRONOGRAMA",
            "La duracion larga (>12m) es el mayor factor de riesgo de no-completado (70.6% tasa historica)",
            "Proyectos cortos (<=3m) tienen muy baja tasa de no-completado (7.7%)",
            "Reemplazar con Modelo 2 de SPI al llegar el primer reporte mensual",
        ],
    }
    with open(ruta_json, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print(f"    Metadata guardada en: {ruta_json}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="Entrena el Modelo A: riesgo de alcance incompleto al cierre"
    )
    parser.add_argument("--datos", required=True,
                        help="Ruta al archivo Excel con indicadores historicos")
    parser.add_argument("--umbral", type=float, default=ALERT_THRESHOLD,
                        help=f"Umbral de probabilidad (default: {ALERT_THRESHOLD})")
    parser.add_argument("--salida", default="modeloA_params.pkl",
                        help="Nombre del archivo .pkl de salida")
    args = parser.parse_args()

    ruta_json = Path(args.salida).stem + "_metadata.json"

    print("=" * 62)
    print("  ENTRENAMIENTO — MODELO A: Riesgo de alcance incompleto")
    print("=" * 62)

    proj_raw                               = cargar_datos(args.datos)
    proj_feat, port_map, lider_map, p_med, lookup = construir_features(proj_raw)
    modelo, metricas, imp                  = entrenar_y_validar(proj_feat, args.umbral)
    guardar_modelo(modelo, metricas, imp,
                   port_map, lider_map, p_med, lookup,
                   args.salida, ruta_json)

    print("\n[5/5] Entrenamiento completado exitosamente")
    print(f"    AUC: {metricas['auc']}  |  Recall: {metricas['recall']}  "
          f"|  Precision: {metricas['precision']}  |  Umbral: {metricas['umbral_alerta']}")
    print(f"\n  Para correr el modelo:")
    print(f"    python correr_modeloA.py --modelo {args.salida} "
          f'--portafolio "TI" --lider "Carlos Osorio" '
          f"--duracion_meses 8 --presupuesto 950000000")
    print("=" * 62)


if __name__ == "__main__":
    main()
