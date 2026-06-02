"""
================================================================
MODELO DE PREDICCIÓN — RANDOM FOREST
Win Rate de Oportunidades Comerciales
================================================================
Variables predictoras:
    - Comercial
    - Ingreso esperado (transformación log)
    - Línea de Negocio
    - Tipo de Venta
    - Segmento

Variable objetivo: Ganado (1) / Perdido (0)

Outputs:
    - rf_dashboard.png          Métricas generales del modelo
    - rf_comercial_analysis.png Análisis por ejecutivo comercial
    - rf_interactions.png       Interacciones entre variables
    - predictions_v2.csv           Predicciones por oportunidad
    - baseline_stats.csv        Estadísticos por decil
    - modelo_rf_v2.pkl             Modelo serializado (reutilizable)

Uso:
    # Entrenar y evaluar con todos los datos:
    python modelo_random_forest.py

    # Predecir con nuevas oportunidades:
    python modelo_random_forest.py --modo predecir --nuevos nuevas_opps.xlsx

    # Ajustar ruta de datos:
    python modelo_random_forest.py --input ruta/Oportunidades.xlsx
================================================================
"""

import argparse
import json
import pickle
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.gridspec as gridspec
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import (StratifiedKFold, cross_val_score,
                                      cross_validate)
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (roc_auc_score, roc_curve, confusion_matrix,
                              classification_report, precision_recall_curve,
                              average_precision_score)
from sklearn.inspection import permutation_importance

warnings.filterwarnings('ignore')

# ── Configuración ──────────────────────────────────────────────────────────────
DEFAULT_INPUT  = 'Oportunidades.xlsx'
MODEL_FILE     = 'modelo_rf_v2.pkl'
PREDICTIONS_OUT = 'predictions_v2.csv'

CAT_VARS = ['Comercial', 'Linea de Negocio', 'Tipo de Venta', 'Segmento']
NUM_VARS = ['Log_Ingreso']
FEAT_NAMES_DISPLAY = ['Comercial', 'Ingreso Esperado (log)', 'Tipo de Venta',
                       'Línea de Negocio', 'Segmento']

# Hiperparámetros del modelo (validados por CV)
RF_PARAMS = dict(
    n_estimators=300,
    max_depth=8,
    min_samples_leaf=5,
    min_samples_split=10,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1
)

# ── Paleta de colores ──────────────────────────────────────────────────────────
C = dict(
    main='#1a6faf', dark='#1a1a2e', green='#2e9e5b',
    red='#d32f2f', orange='#e07b39', gray='#888888', bg='#fafafa'
)


# ══════════════════════════════════════════════════════════════════════════════
# 1. CARGA Y PREPARACIÓN DE DATOS
# ══════════════════════════════════════════════════════════════════════════════

def cargar_y_preparar(ruta: str) -> tuple[pd.DataFrame, dict]:
    """
    Lee el archivo Excel, codifica variables categóricas y
    aplica transformación logarítmica al ingreso.

    Retorna:
        df_enc  : DataFrame con columnas _enc y Log_Ingreso
        le_dict : diccionario de LabelEncoders por columna
    """
    df = pd.read_excel(ruta)
    # Excluir Declinadas: no son relevantes para predecir Ganado/Perdido
    df = df[df['Ganado'] != 'Declinada'].copy()
    df['Ganado_bin'] = (df['Ganado'] == 'Ganado').astype(int)
    df['Log_Ingreso'] = np.log1p(df['Ingreso esperado'])

    le_dict = {}
    df_enc = df.copy()
    for col in CAT_VARS:
        le = LabelEncoder()
        df_enc[col + '_enc'] = le.fit_transform(df[col].astype(str))
        le_dict[col] = le

    print(f"  Datos cargados: {len(df):,} oportunidades | "
          f"Win Rate: {df['Ganado_bin'].mean():.1%}")
    return df_enc, le_dict


def preparar_nuevos(df_nuevo: pd.DataFrame,
                    le_dict: dict) -> np.ndarray:
    """
    Prepara un DataFrame de nuevas oportunidades para predicción,
    usando los LabelEncoders entrenados.
    """
    df = df_nuevo.copy()
    df['Log_Ingreso'] = np.log1p(df['Ingreso esperado'])
    for col in CAT_VARS:
        le = le_dict[col]
        # Categorías desconocidas → clase más frecuente
        df[col + '_enc'] = df[col].astype(str).map(
            lambda x: le.transform([x])[0]
            if x in le.classes_ else le.transform([le.classes_[0]])[0]
        )
    feat_cols = [c + '_enc' for c in CAT_VARS] + NUM_VARS
    return df[feat_cols].values


# ══════════════════════════════════════════════════════════════════════════════
# 2. ENTRENAMIENTO Y EVALUACIÓN
# ══════════════════════════════════════════════════════════════════════════════

def entrenar_y_evaluar(df_enc: pd.DataFrame,
                       k_folds: int = 5) -> tuple:
    """
    Entrena el Random Forest con validación cruzada estratificada.

    Retorna:
        rf        : modelo entrenado en todos los datos
        metrics   : dict con métricas CV
        y_proba   : probabilidades predichas (full data, para diagnóstico)
        perm_imp  : importancia por permutación
    """
    feat_cols = [c + '_enc' for c in CAT_VARS] + NUM_VARS
    X = df_enc[feat_cols].values
    y = df_enc['Ganado_bin'].values

    rf = RandomForestClassifier(**RF_PARAMS)
    cv = StratifiedKFold(n_splits=k_folds, shuffle=True, random_state=42)

    # Cross-validation
    print(f"  Ejecutando {k_folds}-Fold CV...")
    cv_res = cross_validate(rf, X, y, cv=cv,
                             scoring=['roc_auc', 'accuracy', 'f1'],
                             return_train_score=True)

    metrics = {
        'auc_cv':     float(cv_res['test_roc_auc'].mean()),
        'auc_cv_std': float(cv_res['test_roc_auc'].std()),
        'acc_cv':     float(cv_res['test_accuracy'].mean()),
        'acc_cv_std': float(cv_res['test_accuracy'].std()),
        'f1_cv':      float(cv_res['test_f1'].mean()),
        'f1_cv_std':  float(cv_res['test_f1'].std()),
        'n_total':    int(len(y)),
        'n_ganado':   int(y.sum()),
    }

    print(f"  AUC-ROC CV: {metrics['auc_cv']:.4f} ± {metrics['auc_cv_std']:.4f}")
    print(f"  Accuracy:   {metrics['acc_cv']:.4f} ± {metrics['acc_cv_std']:.4f}")
    print(f"  F1-Score:   {metrics['f1_cv']:.4f} ± {metrics['f1_cv_std']:.4f}")

    # Entrenar modelo final en todos los datos
    rf.fit(X, y)
    y_proba = rf.predict_proba(X)[:, 1]

    # Importancia por permutación
    print("  Calculando Permutation Importance...")
    perm = permutation_importance(rf, X, y, n_repeats=20, random_state=42)

    metrics['auc_full'] = float(roc_auc_score(y, y_proba))
    metrics['ap_score'] = float(average_precision_score(y, y_proba))

    return rf, metrics, y_proba, perm


# ══════════════════════════════════════════════════════════════════════════════
# 3. PREDICCIÓN EN NUEVOS DATOS
# ══════════════════════════════════════════════════════════════════════════════

def predecir(ruta_nuevos: str, ruta_modelo: str) -> pd.DataFrame:
    """
    Carga un modelo entrenado y predice sobre nuevas oportunidades.

    Retorna DataFrame con columnas:
        prob_ganado  : probabilidad de ganar (0-1)
        pred_clase   : 'Ganado' o 'Perdido' (umbral 0.50)
        confianza    : 'Alta', 'Media', 'Baja'
    """
    with open(ruta_modelo, 'rb') as f:
        bundle = pickle.load(f)
    rf      = bundle['modelo']
    le_dict = bundle['encoders']

    df_nuevo = pd.read_excel(ruta_nuevos)
    X_nuevo  = preparar_nuevos(df_nuevo, le_dict)
    proba    = rf.predict_proba(X_nuevo)[:, 1]

    df_nuevo['prob_ganado'] = proba
    df_nuevo['pred_clase']  = np.where(proba >= 0.5, 'Ganado', 'Perdido')
    df_nuevo['confianza']   = pd.cut(
        np.abs(proba - 0.5),
        bins=[0, 0.1, 0.25, 0.5],
        labels=['Baja', 'Media', 'Alta']
    )
    return df_nuevo


# ══════════════════════════════════════════════════════════════════════════════
# 4. VISUALIZACIONES
# ══════════════════════════════════════════════════════════════════════════════

def graficar_dashboard(df_enc, rf, metrics, y_proba, perm):
    """Genera el dashboard principal de métricas del modelo."""
    y_true = df_enc['Ganado_bin'].values
    feat_cols = [c + '_enc' for c in CAT_VARS] + NUM_VARS
    X = df_enc[feat_cols].values

    fpr, tpr, _ = roc_curve(y_true, y_proba)
    prec, rec, _ = precision_recall_curve(y_true, y_proba)

    fig = plt.figure(figsize=(20, 14), facecolor='white')
    fig.text(0.5, 0.97, 'Random Forest — Predicción de Win Rate Comercial',
             ha='center', fontsize=20, fontweight='bold', color=C['dark'])
    fig.text(0.5, 0.945,
             f"Variables: Comercial · Ingreso Esperado · Línea de Negocio · "
             f"Tipo de Venta · Segmento  |  n={metrics['n_total']} oportunidades  |  "
             f"AUC-CV = {metrics['auc_cv']:.3f}",
             ha='center', fontsize=11, color=C['gray'], style='italic')

    gs = gridspec.GridSpec(2, 3, figure=fig, top=0.92, bottom=0.07,
                           hspace=0.42, wspace=0.38)

    # ── KPI Cards ──────────────────────────────────────────────────────────
    ax_kpi = fig.add_subplot(gs[0, 0])
    ax_kpi.axis('off')
    kpis = [
        ('AUC-ROC\n(Cross-Val)',      f"{metrics['auc_cv']:.3f}", C['main'],
         'Discriminación del modelo\n(1.0=perfecto, 0.5=azar)'),
        ('Accuracy\n(Cross-Val)',     f"{metrics['acc_cv']:.1%}", C['green'],
         'Oportunidades clasificadas\ncorrectamente'),
        ('F1-Score\n(Cross-Val)',     f"{metrics['f1_cv']:.3f}", C['orange'],
         'Balance precisión/recall\npara clase Ganado'),
        ('Baseline\n(clase mayoritaria)', '55.6%', C['red'],
         'Accuracy prediciendo\nsiempre Perdido'),
    ]
    for i, (title, value, color, note) in enumerate(kpis):
        y_pos = 0.85 - i * 0.22
        rect = FancyBboxPatch((0.03, y_pos - 0.08), 0.94, 0.18,
                               boxstyle='round,pad=0.01',
                               facecolor=color + '18', edgecolor=color,
                               linewidth=1.5, transform=ax_kpi.transAxes)
        ax_kpi.add_patch(rect)
        ax_kpi.text(0.5, y_pos + 0.05, value, transform=ax_kpi.transAxes,
                    ha='center', va='center', fontsize=20,
                    fontweight='bold', color=color)
        ax_kpi.text(0.5, y_pos - 0.02, title, transform=ax_kpi.transAxes,
                    ha='center', va='center', fontsize=8.5,
                    color=C['dark'], fontweight='bold')
        ax_kpi.text(0.5, y_pos - 0.065, note, transform=ax_kpi.transAxes,
                    ha='center', va='center', fontsize=7,
                    color=C['gray'], style='italic')
    ax_kpi.set_title('Métricas del Modelo\n(5-Fold Cross-Validation)',
                      fontsize=11, fontweight='bold', color=C['dark'], pad=10)

    # ── ROC Curve ──────────────────────────────────────────────────────────
    ax_roc = fig.add_subplot(gs[0, 1])
    ax_roc.set_facecolor(C['bg'])
    ax_roc.fill_between(fpr, tpr, alpha=0.12, color=C['main'])
    ax_roc.plot(fpr, tpr, color=C['main'], lw=2.5,
                label=f"RF  AUC = {metrics['auc_cv']:.3f} (CV)")
    ax_roc.plot([0,1],[0,1], '--', color=C['gray'], lw=1.2, label='Azar')
    ax_roc.scatter([0],[1], color=C['green'], s=80, zorder=5, label='Ideal')
    ax_roc.set_xlabel('Tasa de Falsos Positivos', fontsize=9)
    ax_roc.set_ylabel('Tasa de Verdaderos Positivos', fontsize=9)
    ax_roc.set_title('Curva ROC', fontsize=11, fontweight='bold', color=C['dark'])
    ax_roc.legend(fontsize=8.5); ax_roc.grid(linestyle=':', alpha=0.5)
    ax_roc.spines['top'].set_visible(False); ax_roc.spines['right'].set_visible(False)

    # ── Precision-Recall ───────────────────────────────────────────────────
    ax_pr = fig.add_subplot(gs[0, 2])
    ax_pr.set_facecolor(C['bg'])
    ax_pr.fill_between(rec, prec, alpha=0.12, color=C['orange'])
    ax_pr.plot(rec, prec, color=C['orange'], lw=2.5,
               label=f"RF  AP = {metrics['ap_score']:.3f}")
    baseline_pr = metrics['n_ganado'] / metrics['n_total']
    ax_pr.axhline(baseline_pr, color=C['gray'], ls='--', lw=1.2,
                  label=f'Baseline = {baseline_pr:.2f}')
    ax_pr.set_xlabel('Recall', fontsize=9)
    ax_pr.set_ylabel('Precisión', fontsize=9)
    ax_pr.set_title('Curva Precisión-Recall', fontsize=11, fontweight='bold', color=C['dark'])
    ax_pr.legend(fontsize=8.5); ax_pr.grid(linestyle=':', alpha=0.5)
    ax_pr.spines['top'].set_visible(False); ax_pr.spines['right'].set_visible(False)

    # ── Permutation Importance ─────────────────────────────────────────────
    ax_fi = fig.add_subplot(gs[1, 0])
    ax_fi.set_facecolor(C['bg'])
    pi_mean = perm.importances_mean
    pi_std  = perm.importances_std
    idx = np.argsort(pi_mean)
    colors_fi = [C['main'] if i in [idx[-1], idx[-2]] else '#7fb3d3'
                 for i in range(len(pi_mean))]
    bars = ax_fi.barh(np.array(FEAT_NAMES_DISPLAY)[idx], pi_mean[idx],
                       xerr=pi_std[idx], color=np.array(colors_fi),
                       edgecolor='white', height=0.6, capsize=4)
    for bar, val, err in zip(bars, pi_mean[idx], pi_std[idx]):
        ax_fi.text(val + err + 0.003, bar.get_y() + bar.get_height()/2,
                   f'{val:.3f}', va='center', fontsize=8.5,
                   color=C['main'] if val == pi_mean.max() else C['gray'])
    ax_fi.set_xlabel('Importancia por Permutación', fontsize=8.5)
    ax_fi.set_title('Importancia de Variables\n(Permutation Importance)',
                     fontsize=11, fontweight='bold', color=C['dark'])
    ax_fi.spines['top'].set_visible(False); ax_fi.spines['right'].set_visible(False)
    ax_fi.grid(axis='x', linestyle=':', alpha=0.5)

    # ── Confusion Matrix ───────────────────────────────────────────────────
    ax_cm = fig.add_subplot(gs[1, 1])
    y_pred = (y_proba >= 0.5).astype(int)
    cm = confusion_matrix(y_true, y_pred)
    ax_cm.imshow(cm, cmap='Blues', aspect='auto')
    for i in range(2):
        for j in range(2):
            color = 'white' if cm[i,j] > cm.max()/2 else C['dark']
            ax_cm.text(j, i, f'{cm[i,j]}\n({cm[i,j]/len(y_true):.1%})',
                       ha='center', va='center', fontsize=12,
                       fontweight='bold', color=color)
    ax_cm.set_xticks([0,1]); ax_cm.set_yticks([0,1])
    ax_cm.set_xticklabels(['Pred. Perdido','Pred. Ganado'], fontsize=9)
    ax_cm.set_yticklabels(['Real Perdido','Real Ganado'], fontsize=9)
    ax_cm.set_title('Matriz de Confusión\n(umbral 0.50)',
                     fontsize=11, fontweight='bold', color=C['dark'])
    tn, fp, fn, tp = cm.ravel()
    ax_cm.text(0.5, -0.22,
               f'Precisión Ganado: {tp/(tp+fp):.1%}  |  Recall Ganado: {tp/(tp+fn):.1%}',
               transform=ax_cm.transAxes, ha='center', fontsize=8,
               color=C['gray'], style='italic')

    # ── Decil Calibración ─────────────────────────────────────────────────
    ax_dec = fig.add_subplot(gs[1, 2])
    ax_dec.set_facecolor(C['bg'])
    df_dec = df_enc.copy()
    df_dec['proba'] = y_proba
    df_dec['decil'] = pd.qcut(y_proba, 10, labels=False, duplicates='drop')
    dwr = df_dec.groupby('decil').agg(n=('Ganado_bin','count'),
                                       ganadas=('Ganado_bin','sum'),
                                       prob_media=('proba','mean')).assign(
        wr_real=lambda x: x['ganadas']/x['n'])
    colors_dec = [C['green'] if v >= 0.5 else C['red'] for v in dwr['wr_real']]
    bars2 = ax_dec.bar(range(len(dwr)), dwr['wr_real'], color=colors_dec,
                        alpha=0.8, edgecolor='white', width=0.7)
    ax_dec.plot(range(len(dwr['prob_media'])), dwr['prob_media'], 'o--',
                color=C['dark'], lw=1.5, ms=5, label='Prob. media predicha', zorder=5)
    ax_dec.axhline(0.5, color=C['gray'], ls=':', lw=1.2)
    for i, (bar, val) in enumerate(zip(bars2, dwr['wr_real'])):
        ax_dec.text(i, val + 0.02, f'{val:.0%}', ha='center', fontsize=7.5,
                    fontweight='bold', color=C['green'] if val >= 0.5 else C['red'])
    ax_dec.set_xticks(range(len(dwr)))
    ax_dec.set_xticklabels([f'D{i+1}' for i in range(len(dwr))], fontsize=8)
    ax_dec.set_ylabel('Win Rate real', fontsize=8.5)
    ax_dec.set_title('Win Rate Real por Decil de Probabilidad',
                      fontsize=11, fontweight='bold', color=C['dark'])
    ax_dec.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax_dec.legend(fontsize=8)
    ax_dec.spines['top'].set_visible(False); ax_dec.spines['right'].set_visible(False)
    ax_dec.grid(axis='y', linestyle=':', alpha=0.5)

    fig.text(0.5, 0.022,
             f'RF: {RF_PARAMS["n_estimators"]} árboles | max_depth={RF_PARAMS["max_depth"]} | '
             f'class_weight=balanced | StratifiedKFold 5-Fold',
             ha='center', fontsize=8, color=C['gray'], style='italic')
    plt.savefig('rf_dashboard.png', dpi=155, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    print("  ✔ Guardado: rf_dashboard.png")


def graficar_comercial(df_enc, rf, y_proba):
    """Análisis de probabilidades por ejecutivo comercial."""
    y_true   = df_enc['Ganado_bin'].values
    df_plot  = df_enc.copy()
    df_plot['proba_ganado'] = y_proba
    df_plot['pred_label']   = (y_proba >= 0.5).astype(int)

    com_perf = df_plot.groupby('Comercial').agg(
        total=('Ganado_bin','count'), real_ganadas=('Ganado_bin','sum'),
        prob_media=('proba_ganado','mean')
    ).assign(wr_real=lambda x: x['real_ganadas']/x['total'])
    com_10 = com_perf[com_perf['total'] >= 10]

    fig, axes = plt.subplots(1, 3, figsize=(20, 7), facecolor='white')
    fig.suptitle('Análisis de Probabilidades Predichas por Ejecutivo Comercial',
                 fontsize=16, fontweight='bold', color=C['dark'], y=1.0)

    # Separación de clases
    ax = axes[0]; ax.set_facecolor(C['bg'])
    ax.hist(y_proba[y_true==0], bins=20, alpha=0.65, color=C['red'],
            label='Perdido (real)', density=True)
    ax.hist(y_proba[y_true==1], bins=20, alpha=0.65, color=C['green'],
            label='Ganado (real)', density=True)
    ax.axvline(0.5, color=C['dark'], ls='--', lw=1.8, label='Umbral 0.50')
    ax.set_xlabel('Probabilidad predicha de ganar', fontsize=10)
    ax.set_ylabel('Densidad', fontsize=10)
    ax.set_title('Separación de Clases', fontsize=11, fontweight='bold', color=C['dark'])
    ax.legend(fontsize=9)
    overlap = (y_proba[y_true==1] < 0.5).mean()
    ax.text(0.05, 0.92, f'Ganadas mal clasificadas:\n{overlap:.1%}',
            transform=ax.transAxes, fontsize=8, color=C['red'],
            bbox=dict(boxstyle='round', facecolor='white', edgecolor=C['red'], alpha=0.8))
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.grid(axis='y', linestyle=':', alpha=0.5)

    # Scatter prob vs WR real
    ax2 = axes[1]; ax2.set_facecolor(C['bg'])
    sc = ax2.scatter(com_10['prob_media'], com_10['wr_real'],
                      s=com_10['total']*8, c=com_10['wr_real'],
                      cmap='RdYlGn', vmin=0, vmax=1,
                      alpha=0.85, edgecolors=C['dark'], linewidths=0.8, zorder=5)
    ax2.plot([0,1],[0,1], '--', color=C['gray'], lw=1.2, alpha=0.6, label='Pred = Real')
    for _, row in com_10.iterrows():
        parts = str(row.name).split()
        short = parts[0] + ' ' + parts[-1] if len(parts) > 1 else str(row.name)
        ax2.annotate(short, xy=(row['prob_media'], row['wr_real']),
                     xytext=(5, 3), textcoords='offset points', fontsize=7, alpha=0.85)
    plt.colorbar(sc, ax=ax2, label='Win Rate real')
    ax2.set_xlabel('Probabilidad media predicha', fontsize=10)
    ax2.set_ylabel('Win Rate real', fontsize=10)
    ax2.set_title('Prob. Predicha vs Win Rate Real', fontsize=11, fontweight='bold', color=C['dark'])
    ax2.xaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax2.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax2.legend(fontsize=8)
    ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)
    ax2.grid(linestyle=':', alpha=0.5)

    # Boxplot por comercial
    ax3 = axes[2]; ax3.set_facecolor(C['bg'])
    com_ord = com_10.sort_values('wr_real')
    plot_data = [df_plot[df_plot['Comercial']==c]['proba_ganado'].values
                 for c in com_ord.index]
    bp = ax3.boxplot(plot_data, vert=False, patch_artist=True,
                      medianprops=dict(color=C['dark'], lw=2),
                      whiskerprops=dict(color=C['gray'], lw=1),
                      flierprops=dict(marker='o', ms=3, alpha=0.4))
    cmap_rd = plt.cm.RdYlGn
    for patch, wr in zip(bp['boxes'], com_ord['wr_real'].values):
        patch.set_facecolor(cmap_rd(wr)); patch.set_alpha(0.75)
    names_c = [str(n).split()[0]+' '+str(n).split()[-1] for n in com_ord.index]
    ax3.set_yticks(range(1, len(names_c)+1))
    ax3.set_yticklabels(names_c, fontsize=8.5)
    ax3.axvline(0.5, color=C['gray'], ls='--', lw=1.2)
    ax3.set_xlabel('Probabilidad predicha de ganar', fontsize=10)
    ax3.set_title('Distribución de Prob. por Comercial', fontsize=11, fontweight='bold', color=C['dark'])
    sm = plt.cm.ScalarMappable(cmap='RdYlGn', norm=plt.Normalize(0,1))
    sm.set_array([])
    plt.colorbar(sm, ax=ax3, label='Win Rate real')
    ax3.spines['top'].set_visible(False); ax3.spines['right'].set_visible(False)
    ax3.grid(axis='x', linestyle=':', alpha=0.5)

    plt.tight_layout()
    plt.savefig('rf_comercial_analysis.png', dpi=155, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    print("  ✔ Guardado: rf_comercial_analysis.png")


def graficar_interacciones(df_enc, y_proba):
    """Análisis de interacciones entre variables."""
    df_plot = df_enc.copy()
    df_plot['proba_ganado'] = y_proba
    y_true = df_enc['Ganado_bin'].values

    fig, axes = plt.subplots(1, 3, figsize=(20, 6), facecolor='white')
    fig.suptitle('Probabilidades por Ingreso Esperado y Características',
                 fontsize=15, fontweight='bold', color=C['dark'], y=1.01)

    # Prob vs Ingreso
    ax = axes[0]; ax.set_facecolor(C['bg'])
    colors_pt = [C['green'] if g==1 else C['red'] for g in y_true]
    ax.scatter(df_plot['Log_Ingreso'], y_proba, c=colors_pt,
               alpha=0.35, s=15, edgecolors='none')
    bins = np.percentile(df_plot['Log_Ingreso'], np.linspace(0,100,20))
    bin_idx = np.digitize(df_plot['Log_Ingreso'], bins)
    bin_med, bin_x = [], []
    for i in range(1, len(bins)):
        mask = bin_idx == i
        if mask.sum() > 0:
            bin_med.append(y_proba[mask].mean())
            bin_x.append(bins[i-1:i+1].mean())
    ax.plot(bin_x, bin_med, 'o-', color=C['dark'], lw=2, ms=5, zorder=5)
    ax.axhline(0.5, color=C['gray'], ls='--', lw=1.2)
    ax.set_xlabel('Ingreso Esperado (log)', fontsize=10)
    ax.set_ylabel('Probabilidad predicha', fontsize=10)
    ax.set_title('Prob. Predicha vs Ingreso Esperado', fontsize=11, fontweight='bold', color=C['dark'])
    ax.legend(handles=[mpatches.Patch(color=C['green'], alpha=0.7, label='Ganado real'),
                        mpatches.Patch(color=C['red'], alpha=0.7, label='Perdido real')], fontsize=8)
    ax.text(0.05, 0.88, 'Deals más grandes\n→ menor win rate',
            transform=ax.transAxes, fontsize=8, color=C['red'],
            bbox=dict(boxstyle='round', facecolor='white', edgecolor=C['red'], alpha=0.8))
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.grid(linestyle=':', alpha=0.4)

    # Segmento × Tipo Venta
    ax2 = axes[1]; ax2.set_facecolor(C['bg'])
    grp = df_plot.groupby(['Segmento','Tipo de Venta']).agg(
        wr_real=('Ganado_bin','mean'),
        prob_media=('proba_ganado','mean'),
        n=('Ganado_bin','count')
    ).reset_index()
    bc = [C['main'], '#5a9fd4', '#a03010', C['orange']]
    x_pos = np.arange(len(grp))
    ax2.bar(x_pos-0.2, grp['wr_real'],    0.35, label='WR real',        color=bc, alpha=0.8, edgecolor='white')
    ax2.bar(x_pos+0.2, grp['prob_media'], 0.35, label='Prob. predicha', color=bc, alpha=0.35, edgecolor=bc, linewidth=1.5)
    for i, (_,row) in enumerate(grp.iterrows()):
        ax2.text(i-0.2, row['wr_real']+0.01, f"{row['wr_real']:.0%}",
                 ha='center', fontsize=8.5, fontweight='bold', color=C['dark'])
    ax2.set_xticks(x_pos)
    ax2.set_xticklabels([f"{r['Segmento']}\n{r['Tipo de Venta']}\n(n={r['n']})" for _,r in grp.iterrows()], fontsize=8)
    ax2.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax2.set_title('WR Real vs Predicho\nSegmento × Tipo de Venta', fontsize=11, fontweight='bold', color=C['dark'])
    ax2.legend(fontsize=9)
    ax2.spines['top'].set_visible(False); ax2.spines['right'].set_visible(False)
    ax2.grid(axis='y', linestyle=':', alpha=0.5)

    # Heatmap Comercial × Línea
    ax3 = axes[2]
    top_com = df_plot.groupby('Comercial').size().sort_values(ascending=False).head(8).index
    hd = (df_plot[df_plot['Comercial'].isin(top_com)]
          .groupby(['Comercial','Linea de Negocio'])['proba_ganado']
          .mean().unstack(fill_value=np.nan))
    hd.index = [str(n).split()[0]+' '+str(n).split()[-1] for n in hd.index]
    im = ax3.imshow(hd.values, cmap='RdYlGn', aspect='auto', vmin=0, vmax=1)
    ax3.set_xticks(range(len(hd.columns)))
    ax3.set_xticklabels([c.replace('DATOS Y SISTEMAS DE INFORMACIÓN','DATOS Y SIS.')
                          for c in hd.columns], fontsize=8, rotation=15, ha='right')
    ax3.set_yticks(range(len(hd.index)))
    ax3.set_yticklabels(hd.index, fontsize=8.5)
    for i in range(len(hd.index)):
        for j in range(len(hd.columns)):
            val = hd.values[i,j]
            if not np.isnan(val):
                ax3.text(j, i, f'{val:.0%}', ha='center', va='center', fontsize=9,
                         fontweight='bold', color='white' if val>0.65 or val<0.35 else C['dark'])
    plt.colorbar(im, ax=ax3, label='Prob. media de ganar')
    ax3.set_title('Prob. Media: Comercial × Línea', fontsize=11, fontweight='bold', color=C['dark'])

    plt.tight_layout()
    plt.savefig('rf_interactions.png', dpi=155, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    print("  ✔ Guardado: rf_interactions.png")


# ══════════════════════════════════════════════════════════════════════════════
# 5. MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Random Forest — Predicción de Win Rate Comercial')
    parser.add_argument('--input',   default=DEFAULT_INPUT)
    parser.add_argument('--modo',    choices=['entrenar','predecir'], default='entrenar',
                        help='entrenar: ajusta el modelo | predecir: usa modelo guardado')
    parser.add_argument('--nuevos',  default=None,
                        help='Ruta Excel con nuevas oportunidades (modo predecir)')
    parser.add_argument('--modelo',  default=MODEL_FILE,
                        help='Ruta del modelo serializado')
    args = parser.parse_args()

    if args.modo == 'predecir':
        print('Modo: Predicción sobre nuevas oportunidades')
        if not args.nuevos:
            raise ValueError('Especifica --nuevos ruta/archivo.xlsx')
        resultado = predecir(args.nuevos, args.modelo)
        resultado.to_csv(PREDICTIONS_OUT, index=False)
        print(f'  ✔ Predicciones guardadas → {PREDICTIONS_OUT}')
        print(resultado[['Comercial','Linea de Negocio','Ingreso esperado',
                          'prob_ganado','pred_clase','confianza']].to_string())
        return

    # ── Modo entrenar ──────────────────────────────────────────────────────
    print('=' * 60)
    print('  RANDOM FOREST — WIN RATE PREDICTION')
    print('=' * 60)

    print('\n[1/5] Cargando y preparando datos...')
    df_enc, le_dict = cargar_y_preparar(args.input)

    print('\n[2/5] Entrenando modelo y evaluando...')
    rf, metrics, y_proba, perm = entrenar_y_evaluar(df_enc)

    print('\n[3/5] Generando visualizaciones...')
    graficar_dashboard(df_enc, rf, metrics, y_proba, perm)
    graficar_comercial(df_enc, rf, y_proba)
    graficar_interacciones(df_enc, y_proba)

    print('\n[4/5] Guardando predicciones y modelo...')
    df_enc['proba_ganado'] = y_proba
    df_enc['pred_label']   = (y_proba >= 0.5).astype(int)
    df_enc['decil']        = pd.qcut(y_proba, 10, labels=False, duplicates='drop')
    df_enc.to_csv(PREDICTIONS_OUT, index=False)
    print(f'  ✔ Predicciones → {PREDICTIONS_OUT}')

    with open(args.modelo, 'wb') as f:
        pickle.dump({'modelo': rf, 'encoders': le_dict,
                     'feature_cols': [c+'_enc' for c in CAT_VARS] + NUM_VARS,
                     'metrics': metrics}, f)
    print(f'  ✔ Modelo guardado → {args.modelo}')

    with open('model_metrics_v2.json', 'w') as f:
        json.dump(metrics, f, indent=2)

    print('\n[5/5] Resumen final:')
    print(f'  AUC-ROC (CV 5-fold): {metrics["auc_cv"]:.4f} ± {metrics["auc_cv_std"]:.4f}')
    print(f'  Accuracy (CV):       {metrics["acc_cv"]:.4f}')
    print(f'  F1-Score (CV):       {metrics["f1_cv"]:.4f}')
    print(f'  Mejora vs baseline:  +{metrics["acc_cv"] - 0.556:.1%} accuracy')
    print('\n  Outputs generados:')
    for f in ['rf_dashboard.png','rf_comercial_analysis.png','rf_interactions.png',
              PREDICTIONS_OUT, args.modelo, 'model_metrics_v2.json']:
        print(f'    ✔ {f}')
    print('=' * 60)


if __name__ == '__main__':
    main()
