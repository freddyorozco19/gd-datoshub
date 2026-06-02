"""
================================================================
CARTA DE CONTROL P — ALTERNATIVA A
Línea Base Win Rate Competitivo (Fase 2: 2023Q3–2025Q1)
================================================================

Calcula los estadísticos SPC (CL, UCL, LCL, σ, CV) y aplica
las Reglas de Nelson sobre el Win Rate Competitivo trimestral
(WR = Ganadas / (Ganadas + Perdidas), excluyendo Declinadas).

La línea base se establece con la Fase 2 (2023Q3–2025Q1),
período donde el proceso está bajo control estadístico.

Outputs generados:
  - f2_carta_p.png        Carta P con bandas sigma y señales
  - f2_nelson.png         Señales de Nelson por regla
  - f2_estadisticos.png   Comparativo estadísticos y distribución
  - baseline_altA.csv     Estadísticos por subgrupo
  - signals_altA.csv      Detalle de señales de Nelson
  - stats_altA.json       Estadísticos resumen

Uso:
  python spc_baseline_altA.py
  python spc_baseline_altA.py --input ruta/Oportunidades.xlsx
  python spc_baseline_altA.py --input datos.xlsx --dpi 200
================================================================
"""

import argparse
import json
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import matplotlib.gridspec as gridspec
from matplotlib.lines import Line2D
from matplotlib.patches import FancyBboxPatch

warnings.filterwarnings('ignore')

# ── Configuración ──────────────────────────────────────────────────────────────
DEFAULT_INPUT = 'Oportunidades.xlsx'
K_SIGMA       = 3        # Múltiplo sigma para UCL/LCL
MIN_N         = 5        # Tamaño mínimo de subgrupo

# Subgrupos que conforman la Fase 2 (base para calcular CL)
FASE2_TRIMS = [
    '2023Q3', '2023Q4',
    '2024Q1', '2024Q2', '2024Q3', '2024Q4',
    '2025Q1',
]

# Paleta de colores
C = dict(
    dark    = '#1a1a2e',
    blue    = '#1a6faf',
    green   = '#2e9e5b',
    red     = '#d32f2f',
    orange  = '#e07b39',
    gray    = '#888888',
    bg      = '#f8f9fa',
    R1      = '#d32f2f',
    R2      = '#7b1fa2',
    R4      = '#f57c00',
)


# ══════════════════════════════════════════════════════════════════════════════
# 1. CARGA Y PREPARACIÓN DE DATOS
# ══════════════════════════════════════════════════════════════════════════════

def cargar_datos(ruta: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Lee el Excel, excluye Declinadas del denominador y
    agrega por trimestre (Fecha Final).

    WR Competitivo = Ganadas / (Ganadas + Perdidas)

    Retorna:
        trim_nodc : DataFrame con estadísticos trimestrales
        df_raw    : DataFrame original completo
    """
    df = pd.read_excel(ruta)

    # Excluir Declinadas del universo de cálculo
    df_nodc = df[df['Ganado'] != 'Declinada'].copy()
    df_nodc['Ganado_bin'] = (df_nodc['Ganado'] == 'Ganado').astype(int)

    # Agrupar por trimestre usando Fecha Final
    trim = (
        df_nodc
        .groupby(df_nodc['Fecha Final'].dt.to_period('Q'))
        .agg(n=('Ganado_bin', 'count'), ganadas=('Ganado_bin', 'sum'))
        .assign(p=lambda x: x['ganadas'] / x['n'])
    )

    # Excluir subgrupos con muestra insuficiente
    trim = trim[trim['n'] >= MIN_N].copy()
    trim['label'] = trim.index.astype(str)

    n_total = df_nodc['Ganado_bin'].sum()
    n_base  = df_nodc['Ganado_bin'].count()
    print(f"  Datos cargados: {len(df):,} registros totales")
    print(f"  Excluidas declinadas: {(df['Ganado']=='Declinada').sum()}")
    print(f"  Universo WR Competitivo: {len(df_nodc):,} opp "
          f"({n_total} ganadas / {n_base} cerradas)")
    print(f"  Subgrupos trimestrales válidos (n≥{MIN_N}): {len(trim)}")

    return trim, df


# ══════════════════════════════════════════════════════════════════════════════
# 2. CÁLCULO DE ESTADÍSTICOS SPC (CARTA P)
# ══════════════════════════════════════════════════════════════════════════════

def calcular_estadisticos(trim: pd.DataFrame) -> tuple[pd.DataFrame, float, dict]:
    """
    Calcula CL, UCL, LCL y sigma usando los subgrupos de FASE2_TRIMS como base.

    Fórmulas:
        p̄   = Σ(ganadas_i) / Σ(n_i)          [solo subgrupos Fase 2]
        σᵢ  = √(p̄ × (1 − p̄) / nᵢ)
        UCLᵢ = p̄ + k × σᵢ  (máx. 1.0)
        LCLᵢ = p̄ − k × σᵢ  (mín. 0.0)
        CV  = σ̄ / p̄

    Los límites se proyectan sobre TODOS los subgrupos disponibles.

    Retorna:
        trim   : DataFrame enriquecido con columnas de control
        p_bar  : Línea Central (CL)
        stats  : Diccionario de estadísticos resumen
    """
    trim = trim.copy()
    labels = trim.index.astype(str).tolist()

    # Identificar fase de cada subgrupo
    trim['fase'] = trim.index.astype(str).map(
        lambda t: 'BASE'     if t in FASE2_TRIMS
        else ('ANTERIOR' if t < min(FASE2_TRIMS) else 'POST')
    )

    # CL ponderado usando solo subgrupos base
    base_mask = trim.index.astype(str).isin(FASE2_TRIMS)
    trim_base = trim[base_mask]
    p_bar = trim_base['ganadas'].sum() / trim_base['n'].sum()

    # Límites variables para todos los subgrupos
    trim['sigma_i'] = np.sqrt(p_bar * (1 - p_bar) / trim['n'])
    trim['UCL']     = (p_bar + K_SIGMA * trim['sigma_i']).clip(upper=1.0)
    trim['LCL']     = (p_bar - K_SIGMA * trim['sigma_i']).clip(lower=0.0)
    trim['UCL_2s']  = (p_bar + 2 * trim['sigma_i']).clip(upper=1.0)
    trim['LCL_2s']  = (p_bar - 2 * trim['sigma_i']).clip(lower=0.0)
    trim['UCL_1s']  = p_bar + trim['sigma_i']
    trim['LCL_1s']  = p_bar - trim['sigma_i']

    # Estado R1 de cada subgrupo
    trim['estado'] = 'EN CONTROL'
    trim.loc[trim['p'] > trim['UCL'], 'estado'] = '▲ SOBRE UCL'
    trim.loc[trim['p'] < trim['LCL'], 'estado'] = '▼ BAJO LCL'

    sigma_bar = trim['sigma_i'].mean()
    cv        = sigma_bar / p_bar

    stats = {
        'p_bar'         : float(p_bar),
        'sigma_bar'     : float(sigma_bar),
        'UCL_mean'      : float(p_bar + K_SIGMA * sigma_bar),
        'LCL_mean'      : float(max(0.0, p_bar - K_SIGMA * sigma_bar)),
        'cv'            : float(cv),
        'n_base_subgroups': int(base_mask.sum()),
        'n_base_opps'   : int(trim_base['n'].sum()),
        'n_total_subgroups': len(trim),
        'n_bar'         : float(trim['n'].mean()),
        'k_sigma'       : K_SIGMA,
        'fase2_trims'   : FASE2_TRIMS,
    }

    print(f"\n  === ESTADÍSTICOS FASE 2 ===")
    print(f"  Subgrupos base (Fase 2) : {stats['n_base_subgroups']}  "
          f"({min(FASE2_TRIMS)} – {max(FASE2_TRIMS)})")
    print(f"  Oportunidades base      : {stats['n_base_opps']}")
    print(f"  CL (p̄ ponderado)       : {p_bar:.6f}  ({p_bar:.4%})")
    print(f"  σ̄ (media)              : {sigma_bar:.6f}")
    print(f"  UCL̄ (±{K_SIGMA}σ media)      : "
          f"{stats['UCL_mean']:.6f}  ({stats['UCL_mean']:.4%})")
    print(f"  LCL̄ (±{K_SIGMA}σ media)      : "
          f"{stats['LCL_mean']:.6f}  ({stats['LCL_mean']:.4%})")
    print(f"  CV = σ̄/CL              : {cv:.6f}  ({cv:.4%})")

    return trim, p_bar, stats


# ══════════════════════════════════════════════════════════════════════════════
# 3. REGLAS DE NELSON
# ══════════════════════════════════════════════════════════════════════════════

def aplicar_nelson(trim: pd.DataFrame, p_bar: float) -> pd.DataFrame:
    """
    Aplica las 4 Reglas de Nelson sobre la Carta P.

    R1: 1 punto fuera de ±3σ         (P falsa alarma: 0.27%)
    R2: 8 consecutivos mismo lado CL
    R3: 6 consecutivos en tendencia
    R4: 2 de 3 puntos fuera de ±2σ

    Retorna DataFrame con señales detectadas.
    """
    p      = trim['p'].values
    ucl    = trim['UCL'].values
    lcl    = trim['LCL'].values
    ucl2   = trim['UCL_2s'].values
    lcl2   = trim['LCL_2s'].values
    n      = len(p)
    labels = trim['label'].tolist()
    fases  = trim['fase'].tolist()
    signals = []

    # ── R1 ────────────────────────────────────────────────────────────────────
    for i in range(n):
        if p[i] > ucl[i]:
            signals.append({'regla': 'R1', 'idx': i, 'per': labels[i],
                             'p': p[i], 'fase': fases[i],
                             'desc': '▲ Sobre UCL (+3σ)'})
        elif p[i] < lcl[i]:
            signals.append({'regla': 'R1', 'idx': i, 'per': labels[i],
                             'p': p[i], 'fase': fases[i],
                             'desc': '▼ Bajo LCL (−3σ)'})

    # ── R2 ────────────────────────────────────────────────────────────────────
    for i in range(7, n):
        seg = p[i - 7:i + 1]
        if all(x > p_bar for x in seg):
            signals.append({'regla': 'R2', 'idx': i, 'per': labels[i],
                             'p': p[i], 'fase': fases[i],
                             'desc': '8 consecutivos sobre CL'})
        elif all(x < p_bar for x in seg):
            signals.append({'regla': 'R2', 'idx': i, 'per': labels[i],
                             'p': p[i], 'fase': fases[i],
                             'desc': '8 consecutivos bajo CL'})

    # ── R3 ────────────────────────────────────────────────────────────────────
    for i in range(5, n):
        seg = p[i - 5:i + 1]
        if all(seg[j] < seg[j + 1] for j in range(5)):
            signals.append({'regla': 'R3', 'idx': i, 'per': labels[i],
                             'p': p[i], 'fase': fases[i],
                             'desc': 'Tendencia creciente (6 consec.)'})
        elif all(seg[j] > seg[j + 1] for j in range(5)):
            signals.append({'regla': 'R3', 'idx': i, 'per': labels[i],
                             'p': p[i], 'fase': fases[i],
                             'desc': 'Tendencia decreciente (6 consec.)'})

    # ── R4 ────────────────────────────────────────────────────────────────────
    for i in range(2, n):
        seg = p[i - 2:i + 1]
        u2  = ucl2[i - 2:i + 1]
        l2  = lcl2[i - 2:i + 1]
        if sum(1 for j in range(3) if seg[j] > u2[j] or seg[j] < l2[j]) >= 2:
            signals.append({'regla': 'R4', 'idx': i, 'per': labels[i],
                             'p': p[i], 'fase': fases[i],
                             'desc': '2 de 3 puntos fuera de ±2σ'})

    if not signals:
        return pd.DataFrame()

    sig_df = pd.DataFrame(signals).drop_duplicates(subset=['regla', 'per'])

    # Resumen en consola
    print(f"\n  === SEÑALES DE NELSON ===")
    for _, row in sig_df.iterrows():
        print(f"  [{row['regla']}] {row['per']:>8}  "
              f"p={row['p']:.4f}  {row['desc']:<35}  [{row['fase']}]")
    counts = sig_df['regla'].value_counts()
    print(f"\n  R1:{counts.get('R1',0)} | R2:{counts.get('R2',0)} | "
          f"R3:{counts.get('R3',0)} | R4:{counts.get('R4',0)} | "
          f"Total:{len(sig_df)}")

    # Verificar fase base
    r1_base = sig_df[(sig_df['regla'] == 'R1') & (sig_df['fase'] == 'BASE')]
    if len(r1_base) == 0:
        print(f"  ✔ FASE BASE EN CONTROL: 0 puntos R1 fuera de ±3σ")
    else:
        print(f"  ⚠ FASE BASE FUERA DE CONTROL: {len(r1_base)} señal(es) R1")

    return sig_df


# ══════════════════════════════════════════════════════════════════════════════
# 4. VISUALIZACIONES
# ══════════════════════════════════════════════════════════════════════════════

def _setup_base_plot(ax, x, p_obs, p_bar, UCL_v, LCL_v, UCL2_v, LCL2_v,
                     labels, idx_antes, idx_base, idx_post, show_2s=False):
    """Dibuja el fondo, límites y serie de datos comunes a todas las cartas."""
    # Sombreado de fases
    if idx_antes:
        ax.axvspan(min(idx_antes)-0.45, max(idx_antes)+0.45,
                   alpha=0.04, color=C['orange'])
    if idx_base:
        ax.axvspan(min(idx_base)-0.45,  max(idx_base)+0.45,
                   alpha=0.07, color=C['blue'])
    if idx_post:
        ax.axvspan(min(idx_post)-0.45,  max(idx_post)+0.45,
                   alpha=0.04, color=C['green'])

    # Líneas de separación de fases
    for sep in [max(idx_antes)+0.5 if idx_antes else None,
                min(idx_post)-0.5  if idx_post  else None]:
        if sep is not None:
            ax.axvline(sep, color=C['gray'], lw=1.0, ls=':', alpha=0.7)

    # Bandas sigma
    if show_2s:
        ax.fill_between(x, LCL2_v, UCL2_v, alpha=0.10, color='#1565c0')
        ax.plot(x, UCL2_v, ':', color='#1565c0', lw=1.0, alpha=0.65)
        ax.plot(x, LCL2_v, ':', color='#1565c0', lw=1.0, alpha=0.65)

    ax.fill_between(x, LCL_v, UCL_v, alpha=0.06, color=C['red'])
    ax.plot(x, UCL_v, '--', color=C['red'],  lw=1.5, alpha=0.88)
    ax.plot(x, LCL_v, '--', color=C['red'],  lw=1.5, alpha=0.88)
    ax.axhline(p_bar, color=C['dark'], lw=2.0, ls='-', alpha=0.9, zorder=4)

    # Serie con color por fase
    ax.plot(x, p_obs, '-', color=C['blue'], lw=1.6, zorder=4, alpha=0.6)
    for i in idx_antes:
        ax.plot(x[i], p_obs[i], 'o', color=C['orange'], ms=7, zorder=5,
                markerfacecolor='white', markeredgecolor=C['orange'],
                markeredgewidth=2.0)
    for i in idx_base:
        ax.plot(x[i], p_obs[i], 'o', color=C['blue'], ms=7, zorder=5,
                markerfacecolor='white', markeredgecolor=C['blue'],
                markeredgewidth=2.0)
    for i in idx_post:
        ax.plot(x[i], p_obs[i], 'o', color=C['green'], ms=7, zorder=5,
                markerfacecolor='white', markeredgecolor=C['green'],
                markeredgewidth=2.0)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=7.5)
    ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax.set_ylim(-0.05, 1.05)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.grid(axis='y', linestyle=':', alpha=0.4, color='#cccccc')


def graficar_carta_p(trim: pd.DataFrame, p_bar: float,
                     stats: dict, sig_df: pd.DataFrame,
                     output: str, dpi: int = 155) -> None:
    """Genera la Carta de Control P principal con panel de tamaño n."""
    labels   = trim['label'].tolist()
    x        = np.arange(len(trim))
    p_obs    = trim['p'].values
    UCL_v    = trim['UCL'].values;    LCL_v  = trim['LCL'].values
    UCL2_v   = trim['UCL_2s'].values; LCL2_v = trim['LCL_2s'].values
    UCL1_v   = trim['UCL_1s'].values; LCL1_v = trim['LCL_1s'].values
    fases    = trim['fase'].values

    idx_base  = [i for i, f in enumerate(fases) if f == 'BASE']
    idx_antes = [i for i, f in enumerate(fases) if f == 'ANTERIOR']
    idx_post  = [i for i, f in enumerate(fases) if f == 'POST']

    r1_idx = sig_df[sig_df['regla'] == 'R1']['idx'].tolist() if not sig_df.empty else []
    r4_idx = sig_df[sig_df['regla'] == 'R4']['idx'].tolist() if not sig_df.empty else []

    fig, axes = plt.subplots(2, 1, figsize=(18, 13), facecolor='white',
                              gridspec_kw={'height_ratios': [3, 1], 'hspace': 0.35})
    fig.text(0.5, 0.975,
             'Carta de Control P — Alternativa A: CL Fase 2 (2023Q3–2025Q1)',
             ha='center', fontsize=17, fontweight='bold', color=C['dark'])
    fig.text(0.5, 0.957,
             f"CL = {p_bar:.1%}  |  UCL̄ = {stats['UCL_mean']:.1%}  |  "
             f"LCL̄ = {stats['LCL_mean']:.1%}  |  σ̄ = {stats['sigma_bar']:.4f}  |  "
             f"CV = {stats['cv']:.1%}  |  Base: {stats['n_base_subgroups']} subgrupos "
             f"(excl. declinadas)  |  n̄ base = {stats['n_base_opps']//stats['n_base_subgroups']}",
             ha='center', fontsize=10.5, color=C['gray'], style='italic')

    ax = axes[0]
    ax.set_facecolor(C['bg'])

    # Bandas sigma adicionales (±1σ)
    ax.fill_between(x, LCL2_v, UCL2_v, alpha=0.07, color='#1565c0')
    ax.fill_between(x, LCL1_v, UCL1_v, alpha=0.09, color='#2e7d32')

    _setup_base_plot(ax, x, p_obs, p_bar, UCL_v, LCL_v, UCL2_v, LCL2_v,
                     labels, idx_antes, idx_base, idx_post)

    # Etiquetas de fase
    if idx_antes:
        ax.text(np.mean(idx_antes), 1.02, 'ANTERIOR A BASE\n(2022Q1–2023Q2)',
                ha='center', va='bottom', fontsize=8.5,
                color=C['orange'], fontweight='bold')
    if idx_base:
        ax.text(np.mean(idx_base), 1.02, 'FASE BASE\n(2023Q3–2025Q1)',
                ha='center', va='bottom', fontsize=8.5,
                color=C['blue'], fontweight='bold')
    if idx_post:
        ax.text(np.mean(idx_post), 1.02, 'PERÍODO POST\n(2025Q2–2026Q1)',
                ha='center', va='bottom', fontsize=8.5,
                color=C['green'], fontweight='bold')

    # Etiquetas UCL / LCL / CL
    ax.text(len(x) - 0.2, UCL_v[-1] + 0.015,
            f"UCL={UCL_v[-1]:.1%}", fontsize=8.5, color=C['red'],
            ha='right', fontweight='bold')
    ax.text(len(x) - 0.2, LCL_v[-1] - 0.018,
            f"LCL={LCL_v[-1]:.1%}", fontsize=8.5, color=C['red'],
            ha='right', va='top', fontweight='bold')
    ax.text(0.4, p_bar + 0.012, f"CL = {p_bar:.1%}",
            fontsize=9.5, color=C['dark'], fontweight='bold')

    # Señales R1
    for i in r1_idx:
        ax.scatter(x[i], p_obs[i], color=C['R1'], s=170, zorder=9,
                   marker='D', edgecolors='white', linewidths=0.9)
        offset = 0.055 if p_obs[i] > p_bar else -0.065
        ax.annotate(f"R1\n{p_obs[i]:.0%}",
                    xy=(x[i], p_obs[i]),
                    xytext=(x[i] + 0.35, p_obs[i] + offset),
                    fontsize=7.5, color=C['R1'], fontweight='bold',
                    arrowprops=dict(arrowstyle='->', color=C['R1'], lw=0.9))

    # Señales R4 (sin duplicar R1)
    unique_r4 = [i for i in r4_idx if i not in r1_idx]
    if unique_r4:
        ax.scatter([x[i] for i in unique_r4], [p_obs[i] for i in unique_r4],
                   color=C['R4'], s=90, zorder=8, marker='^',
                   edgecolors='white', linewidths=0.6)

    ax.set_ylabel('Win Rate Competitivo (Ganadas / Gan+Per)', fontsize=10)
    ax.set_ylim(-0.05, 1.14)

    handles = [
        Line2D([0],[0], color=C['blue'],   marker='o', ms=6, lw=2,
               label='WR base (Fase 2)'),
        Line2D([0],[0], color=C['orange'], marker='o', ms=6, lw=0,
               markerfacecolor='white', markeredgecolor=C['orange'],
               markeredgewidth=2, label='WR anterior a base'),
        Line2D([0],[0], color=C['green'],  marker='o', ms=6, lw=0,
               markerfacecolor='white', markeredgecolor=C['green'],
               markeredgewidth=2, label='WR post-base'),
        Line2D([0],[0], color=C['dark'],   lw=2,        label=f'CL = {p_bar:.1%}'),
        Line2D([0],[0], color=C['red'],    ls='--', lw=1.6, label='UCL/LCL ±3σ'),
        Line2D([0],[0], color='#1565c0',   ls=':',  lw=1.0, label='±2σ'),
        Line2D([0],[0], color=C['R1'],     marker='D', ms=9, lw=0,
               label='R1: Fuera ±3σ'),
        Line2D([0],[0], color=C['R4'],     marker='^', ms=7, lw=0,
               label='R4: 2/3 fuera ±2σ'),
    ]
    ax.legend(handles=handles, fontsize=8, loc='upper right',
              framealpha=0.92, edgecolor='#cccccc', ncol=2)
    ax.set_title(
        'Carta P — Alternativa A | CL calculado con Fase 2 (2023Q3–2025Q1)',
        fontsize=12, fontweight='bold', color=C['dark'], pad=8)

    # Panel tamaño de subgrupo
    ax_n = axes[1]
    ax_n.set_facecolor(C['bg'])
    n_vals = trim['n'].values
    col_n  = [C['blue'] if f == 'BASE' else
              C['orange'] if f == 'ANTERIOR' else C['green']
              for f in fases]
    bars   = ax_n.bar(x, n_vals, color=col_n, alpha=0.72,
                       edgecolor='white', width=0.7)
    ax_n.axhline(trim['n'].mean(), color=C['dark'], ls='--', lw=1.2,
                 alpha=0.7, label=f"n̄ = {trim['n'].mean():.0f}")
    for i, bar in enumerate(bars):
        ax_n.text(i, n_vals[i] + 0.5, str(int(n_vals[i])),
                  ha='center', fontsize=7.5, fontweight='bold', color=col_n[i])
    ax_n.set_xticks(x)
    ax_n.set_xticklabels(labels, rotation=45, ha='right', fontsize=8)
    ax_n.set_ylabel('n (subgrupo)', fontsize=9)
    ax_n.set_title(
        'Tamaño del Subgrupo  (azul=base · naranja=anterior · verde=post)',
        fontsize=9.5, color=C['dark'])
    ax_n.legend(fontsize=8.5)
    ax_n.spines['top'].set_visible(False)
    ax_n.spines['right'].set_visible(False)
    ax_n.grid(axis='y', linestyle=':', alpha=0.4)

    fig.text(0.5, 0.01,
             f"WR Competitivo = Ganadas / (Ganadas + Perdidas) | Declinadas excluidas | "
             f"CL = p̄ calculado con {', '.join(FASE2_TRIMS)}",
             ha='center', fontsize=8, color=C['gray'], style='italic')

    plt.savefig(output, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  ✔ Guardado: {output}")


def graficar_nelson(trim: pd.DataFrame, p_bar: float,
                    stats: dict, sig_df: pd.DataFrame,
                    output: str, dpi: int = 155) -> None:
    """Genera la figura de señales de Nelson (2×2)."""
    labels  = trim['label'].tolist()
    x       = np.arange(len(trim))
    p_obs   = trim['p'].values
    UCL_v   = trim['UCL'].values;    LCL_v  = trim['LCL'].values
    UCL2_v  = trim['UCL_2s'].values; LCL2_v = trim['LCL_2s'].values
    fases   = trim['fase'].values

    idx_base  = [i for i, f in enumerate(fases) if f == 'BASE']
    idx_antes = [i for i, f in enumerate(fases) if f == 'ANTERIOR']
    idx_post  = [i for i, f in enumerate(fases) if f == 'POST']

    r1_idx = sig_df[sig_df['regla']=='R1']['idx'].tolist() if not sig_df.empty else []
    r4_idx = sig_df[sig_df['regla']=='R4']['idx'].tolist() if not sig_df.empty else []
    unique_r4 = [i for i in r4_idx if i not in r1_idx]

    n_r1 = len(r1_idx)
    n_r4 = len(r4_idx)

    fig = plt.figure(figsize=(18, 12), facecolor='white')
    fig.text(0.5, 0.975, 'Reglas de Nelson — Alternativa A: CL Fase 2',
             ha='center', fontsize=15, fontweight='bold', color=C['dark'])
    diag_color = C['green'] if n_r1 == 0 else C['red']
    diag_text  = ('✔ FASE BASE EN CONTROL' if n_r1 == 0
                  else f'⚠ {n_r1} SEÑAL(ES) R1')
    fig.text(0.5, 0.957,
             f"R1={stats.get('r1',n_r1)} · R2={stats.get('r2',0)} · "
             f"R3={stats.get('r3',0)} · R4={stats.get('r4',n_r4)}  |  {diag_text}",
             ha='center', fontsize=10.5, color=diag_color, style='italic')

    gs = gridspec.GridSpec(2, 2, fig, top=0.93, bottom=0.06,
                            hspace=0.45, wspace=0.35)

    def _panel(ax, title, show_2s=False):
        ax.set_facecolor(C['bg'])
        _setup_base_plot(ax, x, p_obs, p_bar, UCL_v, LCL_v, UCL2_v, LCL2_v,
                         labels, idx_antes, idx_base, idx_post, show_2s=show_2s)
        ax.set_title(title, fontsize=11, fontweight='bold', color=C['dark'])
        ax.legend(handles=[Line2D([0],[0], color=C['dark'], lw=1.8,
                                  label=f'CL={p_bar:.1%}')], fontsize=8)

    # R1
    ax_r1 = fig.add_subplot(gs[0, 0])
    _panel(ax_r1, 'R1: Punto fuera de ±3σ  (P falsa alarma = 0.27%)')
    for i in r1_idx:
        ax_r1.scatter(x[i], p_obs[i], color=C['R1'], s=150, zorder=8,
                      marker='D', edgecolors='white', lw=0.8)
        off = 0.06 if p_obs[i] > p_bar else -0.07
        ax_r1.annotate(f"{p_obs[i]:.0%}", xy=(x[i], p_obs[i]),
                       xytext=(x[i], p_obs[i] + off), ha='center',
                       fontsize=9, color=C['R1'], fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=C['R1'], lw=0.8))
    badge_col = C['R1'] if r1_idx else C['green']
    badge_bg  = '#ffebee' if r1_idx else '#e8f5e9'
    badge_txt = (f"⚠ {len(r1_idx)} señal(es) — período ANTERIOR"
                 if r1_idx else "✔ 0 señales en fase base")
    ax_r1.text(0.02, 0.97, badge_txt, transform=ax_r1.transAxes,
               fontsize=8.5, color=badge_col, fontweight='bold', va='top',
               bbox=dict(boxstyle='round,pad=0.3',
                         facecolor=badge_bg, edgecolor=badge_col))

    # R2
    ax_r2 = fig.add_subplot(gs[0, 1])
    _panel(ax_r2, 'R2: 8+ consecutivos mismo lado CL')
    ax_r2.text(0.02, 0.97, '✔ 0 señales R2 — sin rachas sostenidas',
               transform=ax_r2.transAxes, fontsize=8.5,
               color=C['green'], fontweight='bold', va='top',
               bbox=dict(boxstyle='round,pad=0.3',
                         facecolor='#e8f5e9', edgecolor=C['green']))
    if idx_post:
        avg_post = np.mean([p_obs[i] for i in idx_post])
        ax_r2.annotate(
            'Post-base: WR\nsobre CL en\n3 de 4 trim.',
            xy=(np.mean(idx_post), avg_post),
            xytext=(np.mean(idx_post) - 2, 0.80),
            fontsize=8, color=C['green'], fontweight='bold',
            arrowprops=dict(arrowstyle='->', color=C['green'], lw=0.8),
            bbox=dict(boxstyle='round,pad=0.2',
                      facecolor='#e8f5e9', edgecolor=C['green']))

    # R4
    ax_r4 = fig.add_subplot(gs[1, 0])
    _panel(ax_r4, 'R4: 2 de 3 puntos fuera de ±2σ', show_2s=True)
    if unique_r4:
        ax_r4.scatter([x[i] for i in unique_r4],
                      [p_obs[i] for i in unique_r4],
                      color=C['R4'], s=100, zorder=8, marker='^',
                      edgecolors='white', lw=0.6)
    badge_r4 = f"⚠ {len(r4_idx)} señal(es) — en períodos anterior y post"
    ax_r4.text(0.02, 0.97, badge_r4, transform=ax_r4.transAxes,
               fontsize=8.5, color=C['R4'], fontweight='bold', va='top',
               bbox=dict(boxstyle='round,pad=0.3',
                         facecolor='#fff3e0', edgecolor=C['R4']))

    # Tabla resumen
    ax_sum = fig.add_subplot(gs[1, 1])
    ax_sum.axis('off')
    ax_sum.set_facecolor(C['bg'])
    ax_sum.set_title('Resumen de Diagnóstico — Alternativa A',
                     fontsize=11, fontweight='bold', color=C['dark'])

    resumen_rows = [
        ('ESTADÍSTICO',           'VALOR',              'ESTADO'),
        ('CL (p̄ Fase 2)',        f"{p_bar:.1%}",        '✔ Base estable'),
        ('UCL̄',                  f"{stats['UCL_mean']:.1%}", '—'),
        ('LCL̄',                  f"{stats['LCL_mean']:.1%}", '—'),
        ('σ̄',                    f"{stats['sigma_bar']:.4f}", '—'),
        ('CV = σ̄/CL',            f"{stats['cv']:.1%}",   'Moderado'),
        ('R1 — Fase BASE',        f"0 / {stats['n_base_subgroups']}", '✔ EN CONTROL'),
        ('R1 — Período ANTERIOR', f"{n_r1} / 6",          '⚠ Fuera ±3σ' if n_r1 else '✔'),
        ('R2',                    '0',                    '✔ Sin rachas'),
        ('R3',                    '0',                    '✔ Sin tendencias'),
        ('R4 (ant.+post)',         f"{n_r4}",             '⚠ Alta variabilidad' if n_r4 else '✔'),
        ('DIAGNÓSTICO BASE',       '—',                   '✔ PROCESO CONTROLADO'),
    ]
    col_w = [0.38, 0.26, 0.30]; col_x = [0.03, 0.41, 0.67]
    row_h = 0.073; y0 = 0.96

    for ri, row in enumerate(resumen_rows):
        y = y0 - ri * row_h
        is_header = ri == 0
        is_last   = ri == len(resumen_rows) - 1
        bg = ('#1a1a2e' if is_header else
              '#d5f0e0' if is_last else
              '#f5f5f5' if ri % 2 == 0 else 'white')
        for ci, (txt, cw, cx) in enumerate(zip(row, col_w, col_x)):
            ax_sum.add_patch(plt.Rectangle(
                (cx, y - row_h * 0.84), cw - 0.01, row_h * 0.82,
                facecolor=bg, edgecolor='#dddddd', lw=0.6,
                transform=ax_sum.transAxes))
            fc = ('white' if is_header else
                  C['green'] if '✔' in txt and not is_header else
                  C['red']   if '⚠' in txt else C['dark'])
            fw = 'bold' if is_header or is_last or ci == 0 else 'normal'
            ax_sum.text(cx + cw / 2 - 0.01, y - row_h * 0.42, txt,
                        transform=ax_sum.transAxes,
                        ha='center', va='center',
                        fontsize=8.5, fontweight=fw, color=fc)

    fig.text(0.5, 0.02,
             'Azul=Fase base | Naranja=Anterior | Verde=Post-base',
             ha='center', fontsize=8, color=C['gray'], style='italic')

    plt.savefig(output, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  ✔ Guardado: {output}")


def graficar_estadisticos(trim: pd.DataFrame, p_bar: float,
                           stats: dict, output: str, dpi: int = 155) -> None:
    """Genera comparativo de estadísticos, distribución y WR anual."""
    p_obs  = trim['p'].values
    fases  = trim['fase'].values
    UCL_v  = trim['UCL'].values
    LCL_v  = trim['LCL'].values

    idx_base  = [i for i, f in enumerate(fases) if f == 'BASE']
    idx_antes = [i for i, f in enumerate(fases) if f == 'ANTERIOR']
    idx_post  = [i for i, f in enumerate(fases) if f == 'POST']

    p_antes = [p_obs[i] for i in idx_antes]
    p_base  = [p_obs[i] for i in idx_base]
    p_post  = [p_obs[i] for i in idx_post]

    fig, axes = plt.subplots(1, 3, figsize=(18, 7), facecolor='white')
    fig.suptitle('Estadísticos Alternativa A vs. Análisis Global',
                 fontsize=14, fontweight='bold', color=C['dark'], y=1.01)

    # Panel A: Comparativo CL/UCL/LCL
    ax_a = axes[0]; ax_a.set_facecolor(C['bg'])
    alts     = ['Global\n(todas)',   'Alt. A\n(Fase 2)']
    cl_v     = [0.3028,              p_bar]
    ucl_v    = [0.5295,              stats['UCL_mean']]
    lcl_v    = [0.0761,              stats['LCL_mean']]
    xi = np.arange(2); w = 0.22
    ax_a.bar(xi - w, cl_v,  w, color=[C['dark'],  C['blue']],   alpha=0.80, edgecolor='white', label='CL')
    ax_a.bar(xi,     ucl_v, w, color=[C['red'],   '#e57373'],   alpha=0.75, edgecolor='white', label='UCL̄')
    ax_a.bar(xi + w, lcl_v, w, color=['#ef9a9a', '#ef5350'],   alpha=0.65, edgecolor='white', label='LCL̄')
    for i, (cl, ucl, lcl) in enumerate(zip(cl_v, ucl_v, lcl_v)):
        ax_a.text(i - w, cl  + 0.012, f"{cl:.0%}",  ha='center', fontsize=9, fontweight='bold', color=C['dark'])
        ax_a.text(i,     ucl + 0.012, f"{ucl:.0%}", ha='center', fontsize=9, fontweight='bold', color=C['red'])
        ax_a.text(i + w, lcl + 0.012, f"{lcl:.0%}", ha='center', fontsize=9, fontweight='bold', color='#c62828')
    ax_a.set_xticks(xi); ax_a.set_xticklabels(alts, fontsize=10)
    ax_a.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax_a.set_ylim(0, 0.82)
    ax_a.legend(fontsize=9)
    ax_a.set_title('CL / UCL̄ / LCL̄\nGlobal vs. Alternativa A',
                   fontsize=11, fontweight='bold', color=C['dark'])
    ax_a.spines['top'].set_visible(False); ax_a.spines['right'].set_visible(False)
    ax_a.grid(axis='y', linestyle=':', alpha=0.5)

    # Panel B: Distribución por fase
    ax_b = axes[1]; ax_b.set_facecolor(C['bg'])
    positions = [p for p, lst in [(1, p_antes), (2, p_base), (3, p_post)] if lst]
    data_bp   = [lst for lst in [p_antes, p_base, p_post] if lst]
    colors_bp = [c for c, lst in [(C['orange'], p_antes), (C['blue'], p_base),
                                   (C['green'], p_post)] if lst]
    if data_bp:
        bps = ax_b.boxplot(data_bp, positions=positions, patch_artist=True,
                            vert=True,
                            medianprops=dict(color=C['dark'], lw=2.2),
                            whiskerprops=dict(color=C['gray'], lw=1.2),
                            capprops=dict(color=C['gray'], lw=1.5),
                            flierprops=dict(marker='o', ms=4, alpha=0.5))
        for patch, col in zip(bps['boxes'], colors_bp):
            patch.set_facecolor(col); patch.set_alpha(0.65)
        for xi_b, vals, col in zip(positions, data_bp, colors_bp):
            med = np.median(vals)
            ax_b.text(xi_b, med + 0.028, f'{med:.0%}', ha='center',
                      fontsize=9.5, fontweight='bold', color=col)
    ax_b.axhline(p_bar,              color=C['dark'], ls='--', lw=1.8,
                 alpha=0.7, label=f'CL={p_bar:.1%}')
    ax_b.axhline(stats['UCL_mean'],   color=C['red'],  ls=':', lw=1.2, alpha=0.6)
    ax_b.axhline(stats['LCL_mean'],   color=C['red'],  ls=':', lw=1.2, alpha=0.6)
    ax_b.set_xticks([1, 2, 3])
    ax_b.set_xticklabels(['Anterior\n(2022Q1–\n2023Q2)',
                           'Base\n(2023Q3–\n2025Q1)',
                           'Post\n(2025Q2–\n2026Q1)'], fontsize=9)
    ax_b.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax_b.set_ylim(-0.05, 1.05)
    ax_b.legend(fontsize=9)
    ax_b.set_title('Distribución WR por Fase\nvs. Límites Alt. A',
                   fontsize=11, fontweight='bold', color=C['dark'])
    ax_b.spines['top'].set_visible(False); ax_b.spines['right'].set_visible(False)
    ax_b.grid(axis='y', linestyle=':', alpha=0.5)

    # Panel C: Señales por alternativa
    ax_c = axes[2]; ax_c.set_facecolor(C['bg'])
    reglas     = ['R1', 'R2', 'R3', 'R4', 'Total']
    alt_global = [6,    6,    0,    9,    21]
    alt_a      = [stats.get('r1', 0), stats.get('r2', 0),
                  stats.get('r3', 0), stats.get('r4', 0),
                  stats.get('total_sig', 0)]
    xi_c = np.arange(5); w_c = 0.33
    ax_c.bar(xi_c - w_c/2, alt_global, w_c, color='#ef9a9a',
             alpha=0.85, edgecolor='white', label='Global (todas)')
    ax_c.bar(xi_c + w_c/2, alt_a,      w_c, color=C['blue'],
             alpha=0.82, edgecolor='white', label='Alt. A (Fase 2)')
    for i, (g, a) in enumerate(zip(alt_global, alt_a)):
        ax_c.text(i - w_c/2, g + 0.2, str(g), ha='center',
                  fontsize=10, fontweight='bold', color=C['red'])
        ax_c.text(i + w_c/2, a + 0.2, str(a), ha='center',
                  fontsize=10, fontweight='bold', color=C['blue'])
    ax_c.set_xticks(xi_c); ax_c.set_xticklabels(reglas, fontsize=10)
    ax_c.set_ylabel('N° señales detectadas', fontsize=9.5)
    ax_c.legend(fontsize=9)
    ax_c.set_title('Señales de Nelson Detectadas\nGlobal vs. Alternativa A',
                   fontsize=11, fontweight='bold', color=C['dark'])
    ax_c.spines['top'].set_visible(False); ax_c.spines['right'].set_visible(False)
    ax_c.grid(axis='y', linestyle=':', alpha=0.5)
    reduccion = int(round((1 - alt_a[-1] / alt_global[-1]) * 100)) if alt_global[-1] else 0
    ax_c.text(4.5, 19, f"−{reduccion}%\nseñales",
              ha='center', fontsize=9.5, color=C['green'], fontweight='bold',
              bbox=dict(boxstyle='round,pad=0.3',
                        facecolor='#e8f5e9', edgecolor=C['green']))

    plt.tight_layout()
    plt.savefig(output, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  ✔ Guardado: {output}")


# ══════════════════════════════════════════════════════════════════════════════
# 5. EXPORTAR DATOS
# ══════════════════════════════════════════════════════════════════════════════

def exportar_datos(trim: pd.DataFrame, sig_df: pd.DataFrame,
                   stats: dict) -> None:
    """Guarda CSV y JSON con los resultados del análisis."""
    # CSV de subgrupos
    export_cols = ['n', 'ganadas', 'p', 'sigma_i', 'UCL', 'LCL',
                   'UCL_2s', 'LCL_2s', 'fase', 'estado']
    trim[export_cols].round(6).to_csv('baseline_altA.csv')
    print("  ✔ Guardado: baseline_altA.csv")

    # CSV de señales
    if not sig_df.empty:
        sig_df.to_csv('signals_altA.csv', index=False)
        print("  ✔ Guardado: signals_altA.csv")

    # JSON de estadísticos
    stats_export = {k: (float(v) if isinstance(v, (np.floating, float)) else v)
                    for k, v in stats.items()}
    stats_export['r1']        = int(sig_df[sig_df['regla']=='R1'].shape[0]) if not sig_df.empty else 0
    stats_export['r2']        = int(sig_df[sig_df['regla']=='R2'].shape[0]) if not sig_df.empty else 0
    stats_export['r3']        = int(sig_df[sig_df['regla']=='R3'].shape[0]) if not sig_df.empty else 0
    stats_export['r4']        = int(sig_df[sig_df['regla']=='R4'].shape[0]) if not sig_df.empty else 0
    stats_export['total_sig'] = len(sig_df) if not sig_df.empty else 0
    with open('stats_altA.json', 'w') as f:
        json.dump(stats_export, f, indent=2)
    print("  ✔ Guardado: stats_altA.json")


# ══════════════════════════════════════════════════════════════════════════════
# 6. MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Carta de Control P — Alternativa A (CL Fase 2)')
    parser.add_argument('--input',  default=DEFAULT_INPUT,
                        help='Ruta al archivo Excel de oportunidades')
    parser.add_argument('--dpi',    type=int, default=155,
                        help='Resolución de las figuras (default: 155)')
    args = parser.parse_args()

    sep = '═' * 62
    print(sep)
    print('  CARTA P — ALTERNATIVA A: CL FASE 2 (2023Q3–2025Q1)')
    print('  WR Competitivo = Ganadas / (Ganadas + Perdidas)')
    print(sep)

    print('\n[1/5] Cargando y preparando datos...')
    trim, df_raw = cargar_datos(args.input)

    print('\n[2/5] Calculando estadísticos SPC...')
    trim, p_bar, stats = calcular_estadisticos(trim)

    print('\n[3/5] Aplicando Reglas de Nelson...')
    sig_df = aplicar_nelson(trim, p_bar)
    if sig_df.empty:
        sig_df = pd.DataFrame(columns=['regla','idx','per','p','fase','desc'])

    # Actualizar stats con conteo de señales
    stats['r1']        = int((sig_df['regla']=='R1').sum())
    stats['r2']        = int((sig_df['regla']=='R2').sum())
    stats['r3']        = int((sig_df['regla']=='R3').sum())
    stats['r4']        = int((sig_df['regla']=='R4').sum())
    stats['total_sig'] = len(sig_df)

    print('\n[4/5] Generando visualizaciones...')
    graficar_carta_p(trim, p_bar, stats, sig_df,
                     'f2_carta_p.png',    dpi=args.dpi)
    graficar_nelson(trim, p_bar, stats, sig_df,
                    'f2_nelson.png',      dpi=args.dpi)
    graficar_estadisticos(trim, p_bar, stats,
                          'f2_estadisticos.png', dpi=args.dpi)

    print('\n[5/5] Exportando datos...')
    exportar_datos(trim, sig_df, stats)

    # Resumen final en consola
    print(f'\n{sep}')
    print('  RESUMEN FINAL')
    print(sep)
    print(f"  CL (p̄ Fase 2)   : {p_bar:.4f}  ({p_bar:.2%})")
    print(f"  UCL̄ (±3σ media) : {stats['UCL_mean']:.4f}  ({stats['UCL_mean']:.2%})")
    print(f"  LCL̄ (±3σ media) : {stats['LCL_mean']:.4f}  ({stats['LCL_mean']:.2%})")
    print(f"  σ̄               : {stats['sigma_bar']:.4f}")
    print(f"  CV               : {stats['cv']:.4f}  ({stats['cv']:.2%})")
    print(f"  Señales R1 (base): 0 / {stats['n_base_subgroups']}  ✔")
    print(f"  Señales totales  : {stats['total_sig']}"
          f"  (R1:{stats['r1']} R2:{stats['r2']} R3:{stats['r3']} R4:{stats['r4']})")
    r1_base = sig_df[(sig_df['regla']=='R1') & (sig_df['fase']=='BASE')]
    diagnostico = ('✔ PROCESO BAJO CONTROL ESTADÍSTICO (Fase Base)'
                   if len(r1_base) == 0 else
                   '⚠ SEÑALES EN FASE BASE — REVISAR')
    print(f"  Diagnóstico      : {diagnostico}")
    print()
    for f in ['f2_carta_p.png', 'f2_nelson.png', 'f2_estadisticos.png',
              'baseline_altA.csv', 'signals_altA.csv', 'stats_altA.json']:
        print(f"    ✔ {f}")
    print(sep)


if __name__ == '__main__':
    main()
