"""
================================================================
CARTA DE CONTROL P — ALTERNATIVA B
Línea Base Win Rate Total (Base: 2023Q3–2026Q1, inc. Declinadas)
================================================================

WR = Ganadas / (Ganadas + Perdidas + Declinadas)

Todos los trimestres desde 2023Q3 se usan como base para
calcular el CL. Los datos anteriores a 2023Q3 se excluyen.

Outputs generados:
  altB_carta_p.png        Carta P con bandas sigma y señales
  altB_nelson.png         Señales de Nelson por regla
  altB_estadisticos.png   Comparativo entre alternativas
  baseline_altB.csv       Estadísticos por subgrupo
  signals_altB.csv        Señales de Nelson detectadas
  stats_altB.json         Estadísticos resumen

Uso:
  python spc_baseline_altB.py
  python spc_baseline_altB.py --input ruta/Oportunidades.xlsx
  python spc_baseline_altB.py --input datos.xlsx --dpi 200
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
BASE_START    = '2023Q3'   # Primer trimestre incluido en la base
K_SIGMA       = 3          # Múltiplo sigma para UCL/LCL
MIN_N         = 5          # Tamaño mínimo de subgrupo

# Estadísticos de la Alternativa A (para comparativo)
ALT_A = dict(p_bar=0.4034, UCL_mean=0.6375, LCL_mean=0.1693,
             r1=2, r2=0, r3=0, r4=6, total_sig=8)

# Paleta de colores
C = dict(
    dark   = '#1a1a2e',
    blue   = '#1a6faf',
    green  = '#2e9e5b',
    red    = '#d32f2f',
    orange = '#e07b39',
    gray   = '#888888',
    bg     = '#f8f9fa',
    R1     = '#d32f2f',
    R2     = '#7b1fa2',
    R4     = '#f57c00',
)


# ══════════════════════════════════════════════════════════════════════════════
# 1. CARGA Y PREPARACIÓN
# ══════════════════════════════════════════════════════════════════════════════

def cargar_datos(ruta: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Lee el Excel, filtra desde BASE_START y agrega por trimestre.

    WR Total = Ganadas / (Ganadas + Perdidas + Declinadas)

    Retorna:
        trim    : DataFrame con estadísticos trimestrales
        df_raw  : DataFrame completo (para comparativos)
    """
    df = pd.read_excel(ruta)
    df['Trim']      = df['Fecha Final'].dt.to_period('Q')
    df['Ganado_bin'] = (df['Ganado'] == 'Ganado').astype(int)

    # Filtrar desde BASE_START (inclusive)
    df_base = df[df['Trim'].astype(str) >= BASE_START].copy()

    trim = (
        df_base
        .groupby('Trim')
        .agg(
            n        = ('Ganado_bin', 'count'),
            ganadas  = ('Ganado_bin', 'sum'),
            perdidas = ('Ganado', lambda x: (x == 'Perdido').sum()),
            dec      = ('Ganado', lambda x: (x == 'Declinada').sum()),
        )
        .assign(p=lambda x: x['ganadas'] / x['n'])
    )
    trim = trim[trim['n'] >= MIN_N].copy()
    trim['label'] = trim.index.astype(str)

    n_gan = df_base['Ganado_bin'].sum()
    n_tot = len(df_base)
    print(f"  Registros desde {BASE_START}: {n_tot:,}")
    print(f"  Ganadas: {n_gan}  |  "
          f"Perdidas: {(df_base['Ganado']=='Perdido').sum()}  |  "
          f"Declinadas: {(df_base['Ganado']=='Declinada').sum()}")
    print(f"  WR = {n_gan}/{n_tot} = {n_gan/n_tot:.4%}")
    print(f"  Subgrupos trimestrales válidos (n≥{MIN_N}): {len(trim)}")

    return trim, df


# ══════════════════════════════════════════════════════════════════════════════
# 2. ESTADÍSTICOS SPC
# ══════════════════════════════════════════════════════════════════════════════

def calcular_estadisticos(trim: pd.DataFrame) -> tuple[pd.DataFrame, float, dict]:
    """
    Calcula CL, UCL, LCL y sigma usando TODOS los subgrupos desde BASE_START.

    Fórmulas:
        p̄   = Σ Ganadas_i / Σ n_i
        σᵢ  = √(p̄ × (1 − p̄) / nᵢ)
        UCLᵢ = p̄ + k × σᵢ   (máx. 1.0)
        LCLᵢ = p̄ − k × σᵢ   (mín. 0.0)
        CV   = σ̄ / p̄
    """
    trim  = trim.copy()
    p_bar = trim['ganadas'].sum() / trim['n'].sum()

    trim['sigma_i'] = np.sqrt(p_bar * (1 - p_bar) / trim['n'])
    trim['UCL']     = (p_bar + K_SIGMA * trim['sigma_i']).clip(upper=1.0)
    trim['LCL']     = (p_bar - K_SIGMA * trim['sigma_i']).clip(lower=0.0)
    trim['UCL_2s']  = (p_bar + 2 * trim['sigma_i']).clip(upper=1.0)
    trim['LCL_2s']  = (p_bar - 2 * trim['sigma_i']).clip(lower=0.0)
    trim['UCL_1s']  = p_bar + trim['sigma_i']
    trim['LCL_1s']  = p_bar - trim['sigma_i']
    trim['estado']  = 'EN CONTROL'
    trim.loc[trim['p'] > trim['UCL'], 'estado'] = '▲ SOBRE UCL'
    trim.loc[trim['p'] < trim['LCL'], 'estado'] = '▼ BAJO LCL'

    sigma_bar = trim['sigma_i'].mean()
    cv        = sigma_bar / p_bar

    stats = {
        'p_bar'       : float(p_bar),
        'sigma_bar'   : float(sigma_bar),
        'UCL_mean'    : float(p_bar + K_SIGMA * sigma_bar),
        'LCL_mean'    : float(max(0.0, p_bar - K_SIGMA * sigma_bar)),
        'cv'          : float(cv),
        'n_subgroups' : len(trim),
        'n_bar'       : float(trim['n'].mean()),
        'n_total'     : int(trim['n'].sum()),
        'n_ganadas'   : int(trim['ganadas'].sum()),
        'base_start'  : BASE_START,
        'k_sigma'     : K_SIGMA,
    }

    print(f"\n  === ESTADÍSTICOS ALTERNATIVA B ===")
    print(f"  Base            : desde {BASE_START} (todos los trimestres)")
    print(f"  CL (p̄)         : {p_bar:.6f}  ({p_bar:.4%})")
    print(f"  σ̄ (media)       : {sigma_bar:.6f}")
    print(f"  UCL̄ (±{K_SIGMA}σ media) : {stats['UCL_mean']:.6f}  ({stats['UCL_mean']:.4%})")
    print(f"  LCL̄ (±{K_SIGMA}σ media) : {stats['LCL_mean']:.6f}  ({stats['LCL_mean']:.4%})")
    print(f"  CV = σ̄/CL       : {cv:.6f}  ({cv:.4%})")
    print(f"\n  {'Trim':<10}{'n':>5}{'Gan':>5}{'Per':>5}{'Dec':>5}"
          f"{'p_obs':>8}{'CL':>8}{'UCL':>8}{'LCL':>8}{'sigma':>8}  Estado")
    print('  ' + '─'*85)
    for idx, row in trim.iterrows():
        print(f"  {str(idx):<10}{row['n']:>5.0f}{row['ganadas']:>5.0f}"
              f"{row['perdidas']:>5.0f}{row['dec']:>5.0f}"
              f"{row['p']:>8.4f}{p_bar:>8.4f}"
              f"{row['UCL']:>8.4f}{row['LCL']:>8.4f}"
              f"{row['sigma_i']:>8.4f}  {row['estado']}"
              f"{'  ◄' if row['estado']!='EN CONTROL' else ''}")

    return trim, p_bar, stats


# ══════════════════════════════════════════════════════════════════════════════
# 3. REGLAS DE NELSON
# ══════════════════════════════════════════════════════════════════════════════

def aplicar_nelson(trim: pd.DataFrame, p_bar: float) -> pd.DataFrame:
    """Detecta señales de las 4 Reglas de Nelson."""
    p     = trim['p'].values
    ucl   = trim['UCL'].values;    lcl  = trim['LCL'].values
    ucl2  = trim['UCL_2s'].values; lcl2 = trim['LCL_2s'].values
    n     = len(p)
    lbs   = trim['label'].tolist()
    sigs  = []

    # R1
    for i in range(n):
        if p[i] > ucl[i]:
            sigs.append({'regla':'R1','idx':i,'per':lbs[i],'p':p[i],
                         'desc':'▲ Sobre UCL (+3σ)'})
        elif p[i] < lcl[i]:
            sigs.append({'regla':'R1','idx':i,'per':lbs[i],'p':p[i],
                         'desc':'▼ Bajo LCL (−3σ)'})
    # R2
    for i in range(7, n):
        seg = p[i-7:i+1]
        if all(x > p_bar for x in seg):
            sigs.append({'regla':'R2','idx':i,'per':lbs[i],'p':p[i],
                         'desc':'8 consecutivos sobre CL'})
        elif all(x < p_bar for x in seg):
            sigs.append({'regla':'R2','idx':i,'per':lbs[i],'p':p[i],
                         'desc':'8 consecutivos bajo CL'})
    # R3
    for i in range(5, n):
        seg = p[i-5:i+1]
        if all(seg[j] < seg[j+1] for j in range(5)):
            sigs.append({'regla':'R3','idx':i,'per':lbs[i],'p':p[i],
                         'desc':'Tendencia creciente (6 consec.)'})
        elif all(seg[j] > seg[j+1] for j in range(5)):
            sigs.append({'regla':'R3','idx':i,'per':lbs[i],'p':p[i],
                         'desc':'Tendencia decreciente (6 consec.)'})
    # R4
    for i in range(2, n):
        seg = p[i-2:i+1]; u2 = ucl2[i-2:i+1]; l2 = lcl2[i-2:i+1]
        if sum(1 for j in range(3) if seg[j]>u2[j] or seg[j]<l2[j]) >= 2:
            sigs.append({'regla':'R4','idx':i,'per':lbs[i],'p':p[i],
                         'desc':'2 de 3 puntos fuera de ±2σ'})

    if not sigs:
        print("  ✔ Sin señales de descontrol")
        return pd.DataFrame()

    sig_df = pd.DataFrame(sigs).drop_duplicates(subset=['regla','per'])
    print(f"\n  === SEÑALES DE NELSON ===")
    for _, row in sig_df.iterrows():
        print(f"  [{row['regla']}] {row['per']:>8}  p={row['p']:.4f}  {row['desc']}")
    c = sig_df['regla'].value_counts()
    print(f"\n  R1:{c.get('R1',0)} | R2:{c.get('R2',0)} | "
          f"R3:{c.get('R3',0)} | R4:{c.get('R4',0)} | Total:{len(sig_df)}")

    r1_base = sig_df[sig_df['regla'] == 'R1']
    if len(r1_base) == 0:
        print("  ✔ PROCESO BAJO CONTROL ESTADÍSTICO")
    else:
        print(f"  ⚠ PROCESO FUERA DE CONTROL: {len(r1_base)} señal(es) R1")

    return sig_df


# ══════════════════════════════════════════════════════════════════════════════
# 4. VISUALIZACIONES
# ══════════════════════════════════════════════════════════════════════════════

def graficar_carta_p(trim, p_bar, stats, sig_df, output, dpi=155):
    """Carta P principal con panel de tamaño de subgrupo."""
    labels  = trim['label'].tolist()
    x       = np.arange(len(trim))
    p_obs   = trim['p'].values
    UCL_v   = trim['UCL'].values;    LCL_v  = trim['LCL'].values
    UCL2_v  = trim['UCL_2s'].values; LCL2_v = trim['LCL_2s'].values
    UCL1_v  = trim['UCL_1s'].values; LCL1_v = trim['LCL_1s'].values
    dec_vals = trim['dec'].values

    r1_idx = (sig_df[sig_df['regla']=='R1']['idx'].tolist()
               if not sig_df.empty else [])
    r4_idx = (sig_df[sig_df['regla']=='R4']['idx'].tolist()
               if not sig_df.empty else [])
    unique_r4 = [i for i in r4_idx if i not in r1_idx]

    fig, axes = plt.subplots(2, 1, figsize=(16, 13), facecolor='white',
                              gridspec_kw={'height_ratios':[3,1],'hspace':0.38})
    fig.text(0.5, 0.975,
             'Carta de Control P — Alternativa B: Base 2023Q3–2026Q1 (inc. Declinadas)',
             ha='center', fontsize=16, fontweight='bold', color=C['dark'])
    fig.text(0.5, 0.956,
             f"CL = {p_bar:.1%}  |  UCL̄ = {stats['UCL_mean']:.1%}  |  "
             f"LCL̄ = {stats['LCL_mean']:.1%}  |  σ̄ = {stats['sigma_bar']:.4f}  |  "
             f"CV = {stats['cv']:.1%}  |  {stats['n_subgroups']} subgrupos  |  "
             f"n̄ = {stats['n_bar']:.0f}",
             ha='center', fontsize=10, color=C['gray'], style='italic')

    ax = axes[0]; ax.set_facecolor(C['bg'])

    # Bandas sigma
    ax.fill_between(x, LCL_v,  UCL_v,  alpha=0.06, color=C['red'])
    ax.fill_between(x, LCL2_v, UCL2_v, alpha=0.07, color='#1565c0')
    ax.fill_between(x, LCL1_v, UCL1_v, alpha=0.09, color='#2e7d32')

    # Límites
    ax.plot(x, UCL_v,  '--', color=C['red'],  lw=1.6, alpha=0.9)
    ax.plot(x, LCL_v,  '--', color=C['red'],  lw=1.6, alpha=0.9)
    ax.plot(x, UCL2_v, ':',  color='#1565c0', lw=1.1, alpha=0.55)
    ax.plot(x, LCL2_v, ':',  color='#1565c0', lw=1.1, alpha=0.55)
    ax.axhline(p_bar, color=C['dark'], lw=2.0, ls='-', alpha=0.9, zorder=4)

    # Etiquetas
    ax.text(len(x)-0.2, UCL_v[-1]+0.018, f"UCL={UCL_v[-1]:.1%}",
            fontsize=8.5, color=C['red'], ha='right', fontweight='bold')
    ax.text(len(x)-0.2, LCL_v[-1]-0.020, f"LCL={LCL_v[-1]:.1%}",
            fontsize=8.5, color=C['red'], ha='right', va='top', fontweight='bold')
    ax.text(0.3, p_bar+0.014, f"CL = {p_bar:.1%}",
            fontsize=10, color=C['dark'], fontweight='bold')

    # Serie
    ax.plot(x, p_obs, '-o', color=C['blue'], lw=2.0, ms=7.5,
            markerfacecolor='white', markeredgecolor=C['blue'],
            markeredgewidth=2.2, zorder=6)

    # R1 (diamante rojo)
    for i in r1_idx:
        ax.scatter(x[i], p_obs[i], color=C['R1'], s=180, zorder=9,
                   marker='D', edgecolors='white', linewidths=0.9)
        off = 0.055 if p_obs[i] > p_bar else -0.065
        ax.annotate(f"R1\n{p_obs[i]:.0%}",
                    xy=(x[i], p_obs[i]),
                    xytext=(x[i]+0.35, p_obs[i]+off),
                    fontsize=7.5, color=C['R1'], fontweight='bold',
                    arrowprops=dict(arrowstyle='->', color=C['R1'], lw=0.9))

    # R4 (triángulo naranja)
    if unique_r4:
        ax.scatter([x[i] for i in unique_r4], [p_obs[i] for i in unique_r4],
                   color=C['R4'], s=95, zorder=8, marker='^',
                   edgecolors='white', linewidths=0.6)

    # Anotación de declinadas masivas
    for i, dv in enumerate(dec_vals):
        if dv >= 50:
            ax.text(x[i], p_obs[i]-0.075, f'▲{int(dv)}D',
                    ha='center', fontsize=7.5, color=C['orange'],
                    fontweight='bold')

    ax.set_xticks(x); ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=9)
    ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax.set_ylim(-0.12, 0.85)
    ax.set_ylabel('Win Rate (Ganadas / Total inc. Declinadas)', fontsize=10)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
    ax.grid(axis='y', linestyle=':', alpha=0.5)

    # Badge diagnóstico
    n_r1 = stats.get('r1', 0)
    bc   = C['red'] if n_r1 > 0 else C['green']
    bb   = '#ffebee' if n_r1 > 0 else '#e8f5e9'
    bt   = (f"⚠ {n_r1} señal(es) R1 — PROCESO FUERA DE CONTROL"
            if n_r1 > 0 else "✔ PROCESO EN CONTROL")
    ax.text(0.01, 0.99, bt, transform=ax.transAxes, fontsize=9.5,
            color=bc, fontweight='bold', va='top',
            bbox=dict(boxstyle='round,pad=0.35', facecolor=bb,
                      edgecolor=bc, lw=1.5))

    handles = [
        Line2D([0],[0], color=C['blue'],   marker='o', ms=6, lw=2,
               label='WR observado'),
        Line2D([0],[0], color=C['dark'],   lw=2,
               label=f'CL = {p_bar:.1%}'),
        Line2D([0],[0], color=C['red'],    ls='--', lw=1.6,
               label='UCL/LCL ±3σ'),
        Line2D([0],[0], color='#1565c0',   ls=':',  lw=1.1,
               label='±2σ'),
        Line2D([0],[0], color=C['R1'],     marker='D', ms=9, lw=0,
               label='R1: Fuera ±3σ'),
        Line2D([0],[0], color=C['R4'],     marker='^', ms=7, lw=0,
               label='R4: 2/3 fuera ±2σ'),
        Line2D([0],[0], color=C['orange'], lw=0,
               label='▲D = N° declinadas en trim.'),
    ]
    ax.legend(handles=handles, fontsize=8, loc='upper right',
              framealpha=0.93, edgecolor='#ccc', ncol=2)
    ax.set_title(
        'Carta P — Alternativa B | WR Total (inc. declinadas) | Base: 2023Q3–2026Q1',
        fontsize=11, fontweight='bold', color=C['dark'], pad=8)

    # Panel n
    ax_n = axes[1]; ax_n.set_facecolor(C['bg'])
    n_vals = trim['n'].values
    col_n  = [C['orange'] if d > 50 else C['blue'] for d in dec_vals]
    bars_n = ax_n.bar(x, n_vals, color=col_n, alpha=0.72,
                       edgecolor='white', width=0.7)
    ax_n.bar(x, dec_vals, color=C['orange'], alpha=0.50,
             edgecolor='white', width=0.7, label='Declinadas')
    for i, bar in enumerate(bars_n):
        ax_n.text(i, n_vals[i]+0.8, str(int(n_vals[i])), ha='center',
                  fontsize=7.5, fontweight='bold', color=col_n[i])
    ax_n.axhline(trim['n'].mean(), color=C['dark'], ls='--', lw=1.2,
                 alpha=0.7, label=f"n̄={trim['n'].mean():.0f}")
    ax_n.set_xticks(x); ax_n.set_xticklabels(labels, rotation=45,
                                               ha='right', fontsize=8.5)
    ax_n.set_ylabel('n (subgrupo)', fontsize=9)
    ax_n.set_title('Tamaño del Subgrupo (naranja = trimestres con ≥50 declinadas)',
                   fontsize=9.5, color=C['dark'])
    ax_n.legend(fontsize=8, ncol=2)
    ax_n.spines['top'].set_visible(False); ax_n.spines['right'].set_visible(False)
    ax_n.grid(axis='y', linestyle=':', alpha=0.4)

    fig.text(0.5, 0.01,
             f"WR = Ganadas / (Ganadas + Perdidas + Declinadas) | "
             f"UCL/LCL = p̄ ± 3√(p̄(1−p̄)/nᵢ) | CL={p_bar:.4f}",
             ha='center', fontsize=8, color=C['gray'], style='italic')

    plt.savefig(output, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  ✔ Guardado: {output}")


def graficar_nelson(trim, p_bar, stats, sig_df, output, dpi=155):
    """Figura 2×2 de señales de Nelson."""
    labels  = trim['label'].tolist()
    x       = np.arange(len(trim))
    p_obs   = trim['p'].values
    UCL_v   = trim['UCL'].values;    LCL_v  = trim['LCL'].values
    UCL2_v  = trim['UCL_2s'].values; LCL2_v = trim['LCL_2s'].values

    r1_idx = (sig_df[sig_df['regla']=='R1']['idx'].tolist()
               if not sig_df.empty else [])
    r4_idx = (sig_df[sig_df['regla']=='R4']['idx'].tolist()
               if not sig_df.empty else [])
    unique_r4 = [i for i in r4_idx if i not in r1_idx]

    fig = plt.figure(figsize=(16, 12), facecolor='white')
    n_r1 = stats.get('r1', 0)
    fig.text(0.5, 0.975, 'Reglas de Nelson — Alternativa B (inc. Declinadas)',
             ha='center', fontsize=15, fontweight='bold', color=C['dark'])
    fig.text(0.5, 0.957,
             f"R1={stats.get('r1',0)} · R2={stats.get('r2',0)} · "
             f"R3={stats.get('r3',0)} · R4={stats.get('r4',0)}  |  "
             f"{'⚠ PROCESO FUERA DE CONTROL' if n_r1>0 else '✔ EN CONTROL'}",
             ha='center', fontsize=10.5,
             color=C['red'] if n_r1>0 else C['green'], style='italic')

    gs = gridspec.GridSpec(2, 2, fig, top=0.93, bottom=0.06,
                            hspace=0.45, wspace=0.35)

    def _base(ax, show_2s=False):
        if show_2s:
            ax.fill_between(x, LCL2_v, UCL2_v, alpha=0.10, color='#1565c0')
            ax.plot(x, UCL2_v, ':', color='#1565c0', lw=1.0, alpha=0.65)
            ax.plot(x, LCL2_v, ':', color='#1565c0', lw=1.0, alpha=0.65)
        ax.fill_between(x, LCL_v, UCL_v, alpha=0.06, color=C['red'])
        ax.plot(x, UCL_v, '--', color=C['red'], lw=1.4, alpha=0.85)
        ax.plot(x, LCL_v, '--', color=C['red'], lw=1.4, alpha=0.85)
        ax.axhline(p_bar, color=C['dark'], lw=1.9, ls='-', alpha=0.9)
        ax.plot(x, p_obs, '-o', color=C['blue'], lw=1.6, ms=6.5,
                markerfacecolor='white', markeredgecolor=C['blue'],
                markeredgewidth=1.9, zorder=5)
        ax.text(len(x)-0.2, p_bar+0.015, f"CL={p_bar:.1%}",
                fontsize=8, color=C['dark'], fontweight='bold', ha='right')
        ax.set_xticks(x)
        ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=8)
        ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
        ax.set_ylim(-0.08, 0.80)
        ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
        ax.grid(axis='y', linestyle=':', alpha=0.4)

    # R1
    ax_r1 = fig.add_subplot(gs[0,0]); ax_r1.set_facecolor(C['bg'])
    _base(ax_r1)
    for i in r1_idx:
        ax_r1.scatter(x[i], p_obs[i], color=C['R1'], s=160, zorder=8,
                      marker='D', edgecolors='white', lw=0.8)
        off = 0.055 if p_obs[i] > p_bar else -0.065
        ax_r1.annotate(f"{p_obs[i]:.0%}", xy=(x[i], p_obs[i]),
                       xytext=(x[i], p_obs[i]+off), ha='center',
                       fontsize=9, color=C['R1'], fontweight='bold',
                       arrowprops=dict(arrowstyle='->', color=C['R1'], lw=0.8))
    bc = C['R1'] if r1_idx else C['green']
    bb = '#ffebee' if r1_idx else '#e8f5e9'
    ax_r1.text(0.02, 0.98,
               f"⚠ {len(r1_idx)} señal(es)" if r1_idx else "✔ 0 señales",
               transform=ax_r1.transAxes, fontsize=9.5, color=bc,
               fontweight='bold', va='top',
               bbox=dict(boxstyle='round,pad=0.3', facecolor=bb, edgecolor=bc))
    ax_r1.set_title('R1: Punto fuera de ±3σ', fontsize=11,
                     fontweight='bold', color=C['dark'])

    # R2
    ax_r2 = fig.add_subplot(gs[0,1]); ax_r2.set_facecolor(C['bg'])
    _base(ax_r2)
    below = [i for i in range(len(p_obs)) if p_obs[i] < p_bar]
    above = [i for i in range(len(p_obs)) if p_obs[i] >= p_bar]
    ax_r2.scatter([x[i] for i in below], [p_obs[i] for i in below],
                  color='#aaa', s=40, zorder=6, marker='v', alpha=0.7,
                  label='Bajo CL')
    ax_r2.scatter([x[i] for i in above], [p_obs[i] for i in above],
                  color='#aaa', s=40, zorder=6, marker='^', alpha=0.7,
                  label='Sobre CL')
    # Anotar racha de 7 puntos bajo CL (no llega a R2=8 pero es notable)
    ax_r2.annotate('7 pts. consec.\nbajo CL\n(2025Q1→2026Q1)',
                   xy=(7, p_obs[7]), xytext=(4.5, 0.62),
                   fontsize=8, color='#555', fontweight='bold',
                   arrowprops=dict(arrowstyle='->', color='#555', lw=0.8),
                   bbox=dict(boxstyle='round,pad=0.2',
                             facecolor='#f5f5f5', edgecolor='#aaa'))
    ax_r2.text(0.02, 0.98, '✔ 0 señales R2',
               transform=ax_r2.transAxes, fontsize=9.5, color=C['green'],
               fontweight='bold', va='top',
               bbox=dict(boxstyle='round,pad=0.3',
                         facecolor='#e8f5e9', edgecolor=C['green']))
    ax_r2.legend(fontsize=8)
    ax_r2.set_title('R2: 8+ consecutivos mismo lado CL', fontsize=11,
                     fontweight='bold', color=C['dark'])

    # R4
    ax_r4 = fig.add_subplot(gs[1,0]); ax_r4.set_facecolor(C['bg'])
    _base(ax_r4, show_2s=True)
    if unique_r4:
        ax_r4.scatter([x[i] for i in unique_r4], [p_obs[i] for i in unique_r4],
                      color=C['R4'], s=100, zorder=8, marker='^',
                      edgecolors='white', lw=0.6)
    for i in r1_idx:
        ax_r4.scatter(x[i], p_obs[i], color=C['R1'], s=140, zorder=9,
                      marker='D', edgecolors='white', lw=0.8)
    ax_r4.text(0.02, 0.98, f"⚠ {len(r4_idx)} señal(es) R4",
               transform=ax_r4.transAxes, fontsize=9.5, color=C['R4'],
               fontweight='bold', va='top',
               bbox=dict(boxstyle='round,pad=0.3',
                         facecolor='#fff3e0', edgecolor=C['R4']))
    ax_r4.set_title('R4: 2/3 puntos fuera de ±2σ', fontsize=11,
                     fontweight='bold', color=C['dark'])

    # Tabla comparativo
    ax_sum = fig.add_subplot(gs[1,1])
    ax_sum.axis('off'); ax_sum.set_facecolor(C['bg'])
    ax_sum.set_title('Comparativo Alternativa B vs. Alternativa A',
                      fontsize=11, fontweight='bold', color=C['dark'])

    rows = [
        ('ESTADÍSTICO',    'ALT. A (sin dec.)', 'ALT. B (inc. dec.)', 'DIFER.'),
        ('CL',             '40.3%',  f"{stats['p_bar']:.1%}",    '−16.5pp'),
        ('UCL̄',            '63.7%',  f"{stats['UCL_mean']:.1%}", '−22.4pp'),
        ('LCL̄',            '16.9%',  f"{stats['LCL_mean']:.1%}", '−10.5pp'),
        ('σ̄',              '0.0780', f"{stats['sigma_bar']:.4f}",'−0.0199'),
        ('CV',             '19.3%',  f"{stats['cv']:.1%}",       '+5.1pp'),
        ('Señales R1',     '2',      str(stats.get('r1',0)),     '+2 en base'),
        ('Señales R4',     '6',      str(stats.get('r4',0)),     '+1'),
        ('Total señales',  '8',      str(stats.get('total_sig',0)), '+3'),
        ('Fase ctrl.',     '✔ Sí',   '⚠ No',                    '4 R1'),
    ]
    col_w = [0.29, 0.21, 0.23, 0.22]
    col_x = [0.02, 0.32, 0.54, 0.78]
    rh = 0.083; y0 = 0.95

    for ri, row in enumerate(rows):
        y = y0 - ri*rh
        bg_r = ('#1a1a2e' if ri == 0 else
                '#ffebee' if '⚠' in str(row) or (ri==6 and '+' in row[3]) else
                '#e8f5e9' if '✔' in str(row) else
                '#f5f5f5' if ri%2==0 else 'white')
        if ri == len(rows)-1: bg_r = '#ffebee'
        for ci, (txt, cw, cx) in enumerate(zip(row, col_w, col_x)):
            ax_sum.add_patch(plt.Rectangle(
                (cx, y-rh*0.84), cw-0.01, rh*0.82,
                facecolor=bg_r, edgecolor='#dddddd', lw=0.6,
                transform=ax_sum.transAxes))
            fc = ('white'   if ri==0 else
                  C['red']  if '⚠' in str(txt) or (ri>=6 and ci==3 and '+' in str(txt)) else
                  C['green']if '✔' in str(txt) else C['dark'])
            fw = 'bold' if ri==0 or ci==0 or ri==len(rows)-1 else 'normal'
            ax_sum.text(cx+cw/2-0.005, y-rh*0.42, txt,
                        transform=ax_sum.transAxes,
                        ha='center', va='center',
                        fontsize=8.5, fontweight=fw, color=fc)

    fig.text(0.5, 0.02,
             'R1: 1 punto ±3σ | R2: 8 consec. | R3: tendencia 6 | R4: 2/3 en ±2σ',
             ha='center', fontsize=8, color=C['gray'], style='italic')

    plt.savefig(output, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  ✔ Guardado: {output}")


def graficar_estadisticos(trim, p_bar, stats, df_raw, output, dpi=155):
    """Comparativo estadísticos y distribución."""
    p_obs    = trim['p'].values
    UCL_v    = trim['UCL'].values
    LCL_v    = trim['LCL'].values
    labels   = trim['label'].tolist()
    x        = np.arange(len(trim))

    # Calcular WR sin declinadas (Alt A) para el mismo período
    df_nodc = df_raw[df_raw['Ganado'] != 'Declinada'].copy()
    df_nodc['Trim']       = df_nodc['Fecha Final'].dt.to_period('Q')
    df_nodc['Ganado_bin'] = (df_nodc['Ganado'] == 'Ganado').astype(int)
    trim_a = (df_nodc[df_nodc['Fecha Final'].dt.to_period('Q').astype(str) >= BASE_START]
              .groupby(df_nodc['Fecha Final'].dt.to_period('Q'))
              .agg(n=('Ganado_bin','count'), g=('Ganado_bin','sum'))
              .assign(p=lambda d: d['g']/d['n']))

    fig, axes = plt.subplots(1, 3, figsize=(18, 7), facecolor='white')
    fig.suptitle('Estadísticos — Alternativa B vs. Alternativa A vs. Global',
                 fontsize=14, fontweight='bold', color=C['dark'], y=1.01)

    # Panel A: comparativo CL/UCL/LCL
    ax_a = axes[0]; ax_a.set_facecolor(C['bg'])
    alts  = ['Global\n(todas)', 'Alt. A\n(sin dec.)', 'Alt. B\n(inc. dec.)']
    cl_v  = [0.3028,  ALT_A['p_bar'],  p_bar]
    ucl_v = [0.5295,  ALT_A['UCL_mean'], stats['UCL_mean']]
    lcl_v = [0.0761,  ALT_A['LCL_mean'], stats['LCL_mean']]
    xi_a  = np.arange(3); w_a = 0.22
    ax_a.bar(xi_a-w_a, cl_v,  w_a, color=['#888', C['blue'], C['orange']],
             alpha=0.82, edgecolor='white', label='CL')
    ax_a.bar(xi_a,     ucl_v, w_a, color=['#e57373','#ef9a9a',C['red']],
             alpha=0.75, edgecolor='white', label='UCL̄')
    ax_a.bar(xi_a+w_a, lcl_v, w_a, color=['#ef9a9a','#ffcdd2','#e53935'],
             alpha=0.65, edgecolor='white', label='LCL̄')
    for i, (cl, ucl, lcl) in enumerate(zip(cl_v, ucl_v, lcl_v)):
        ax_a.text(xi_a[i]-w_a, cl+0.013,  f"{cl:.0%}",  ha='center',
                  fontsize=8.5, fontweight='bold', color=C['dark'])
        ax_a.text(xi_a[i],     ucl+0.013, f"{ucl:.0%}", ha='center',
                  fontsize=8.5, fontweight='bold', color=C['red'])
        ax_a.text(xi_a[i]+w_a, lcl+0.013, f"{lcl:.0%}", ha='center',
                  fontsize=8.5, fontweight='bold', color='#c62828')
    ax_a.set_xticks(xi_a); ax_a.set_xticklabels(alts, fontsize=9.5)
    ax_a.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax_a.set_ylim(0, 0.82); ax_a.legend(fontsize=9)
    ax_a.set_title('CL / UCL̄ / LCL̄\nlas Tres Alternativas',
                   fontsize=11, fontweight='bold', color=C['dark'])
    ax_a.spines['top'].set_visible(False); ax_a.spines['right'].set_visible(False)
    ax_a.grid(axis='y', linestyle=':', alpha=0.5)

    # Panel B: Alt A vs Alt B (mismos trimestres)
    ax_b = axes[1]; ax_b.set_facecolor(C['bg'])
    p_a = trim_a['p'].values[:len(x)]
    ax_b.plot(x, p_obs, 'o-', color=C['orange'], lw=2, ms=7,
              markerfacecolor='white', markeredgecolor=C['orange'],
              markeredgewidth=2, label='Alt. B — WR Total (inc. dec.)', zorder=5)
    ax_b.plot(x[:len(p_a)], p_a, 's-', color=C['blue'], lw=2, ms=7,
              markerfacecolor='white', markeredgecolor=C['blue'],
              markeredgewidth=2, label='Alt. A — WR Compet. (exc. dec.)', zorder=5)
    ax_b.axhline(p_bar,              color=C['orange'], ls='--', lw=1.4,
                 alpha=0.7, label=f'CL Alt.B={p_bar:.0%}')
    ax_b.axhline(ALT_A['p_bar'],     color=C['blue'],   ls='--', lw=1.4,
                 alpha=0.7, label=f"CL Alt.A={ALT_A['p_bar']:.0%}")
    ax_b.fill_between(x, LCL_v, UCL_v, alpha=0.06, color=C['orange'])
    ax_b.set_xticks(x)
    ax_b.set_xticklabels(labels, rotation=45, ha='right', fontsize=8)
    ax_b.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
    ax_b.set_ylim(-0.05, 0.80)
    ax_b.set_ylabel('Win Rate', fontsize=9)
    ax_b.legend(fontsize=8, loc='upper right', framealpha=0.92)
    ax_b.set_title('WR Alt. A vs. Alt. B\n(2023Q3–2026Q1)',
                   fontsize=11, fontweight='bold', color=C['dark'])
    ax_b.spines['top'].set_visible(False); ax_b.spines['right'].set_visible(False)
    ax_b.grid(axis='y', linestyle=':', alpha=0.5)

    # Panel C: Señales comparativo
    ax_c = axes[2]; ax_c.set_facecolor(C['bg'])
    reglas     = ['R1', 'R2', 'R3', 'R4', 'Total']
    alt_global = [6, 6, 0, 9, 21]
    alt_a_sig  = [ALT_A['r1'], ALT_A['r2'], ALT_A['r3'], ALT_A['r4'], ALT_A['total_sig']]
    alt_b_sig  = [stats.get('r1',0), stats.get('r2',0), stats.get('r3',0),
                  stats.get('r4',0), stats.get('total_sig',0)]
    xi_c = np.arange(5); w_c = 0.25
    ax_c.bar(xi_c-w_c,   alt_global, w_c, color='#bdbdbd', alpha=0.82,
             edgecolor='white', label='Global (todas)')
    ax_c.bar(xi_c,       alt_a_sig,  w_c, color=C['blue'],   alpha=0.82,
             edgecolor='white', label='Alt. A (sin dec.)')
    ax_c.bar(xi_c+w_c,   alt_b_sig,  w_c, color=C['orange'], alpha=0.82,
             edgecolor='white', label='Alt. B (inc. dec.)')
    for i, (g, a, b) in enumerate(zip(alt_global, alt_a_sig, alt_b_sig)):
        ax_c.text(xi_c[i]-w_c, g+0.15, str(g), ha='center',
                  fontsize=9, fontweight='bold', color='#555')
        ax_c.text(xi_c[i],     a+0.15, str(a), ha='center',
                  fontsize=9, fontweight='bold', color=C['blue'])
        ax_c.text(xi_c[i]+w_c, b+0.15, str(b), ha='center',
                  fontsize=9, fontweight='bold', color=C['orange'])
    ax_c.set_xticks(xi_c); ax_c.set_xticklabels(reglas, fontsize=10)
    ax_c.set_ylabel('N° señales', fontsize=9.5)
    ax_c.legend(fontsize=8.5)
    ax_c.set_title('Señales de Nelson\nGlobal vs. Alt. A vs. Alt. B',
                   fontsize=11, fontweight='bold', color=C['dark'])
    ax_c.spines['top'].set_visible(False); ax_c.spines['right'].set_visible(False)
    ax_c.grid(axis='y', linestyle=':', alpha=0.5)

    plt.tight_layout()
    plt.savefig(output, dpi=dpi, bbox_inches='tight', facecolor='white')
    plt.close()
    print(f"  ✔ Guardado: {output}")


# ══════════════════════════════════════════════════════════════════════════════
# 5. EXPORTAR
# ══════════════════════════════════════════════════════════════════════════════

def exportar(trim, sig_df, stats):
    export_cols = ['n','ganadas','perdidas','dec','p',
                   'sigma_i','UCL','LCL','UCL_2s','LCL_2s','estado']
    trim[export_cols].round(6).to_csv('baseline_altB.csv')
    print("  ✔ Guardado: baseline_altB.csv")
    if not sig_df.empty:
        sig_df.to_csv('signals_altB.csv', index=False)
        print("  ✔ Guardado: signals_altB.csv")
    stats_out = {k: (float(v) if isinstance(v, (np.floating, float)) else v)
                 for k, v in stats.items()}
    with open('stats_altB.json', 'w') as f:
        json.dump(stats_out, f, indent=2)
    print("  ✔ Guardado: stats_altB.json")


# ══════════════════════════════════════════════════════════════════════════════
# 6. MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description='Carta P — Alternativa B: base 2023Q3 en adelante, inc. declinadas')
    parser.add_argument('--input',  default=DEFAULT_INPUT)
    parser.add_argument('--dpi',    type=int, default=155)
    args = parser.parse_args()

    sep = '═' * 62
    print(sep)
    print('  CARTA P — ALTERNATIVA B: BASE 2023Q3–2026Q1')
    print('  WR Total = Ganadas / (Gan + Per + Dec)')
    print(sep)

    print('\n[1/5] Cargando datos...')
    trim, df_raw = cargar_datos(args.input)

    print('\n[2/5] Calculando estadísticos...')
    trim, p_bar, stats = calcular_estadisticos(trim)

    print('\n[3/5] Aplicando Reglas de Nelson...')
    sig_df = aplicar_nelson(trim, p_bar)
    if sig_df.empty:
        sig_df = pd.DataFrame(columns=['regla','idx','per','p','desc'])
    stats['r1']        = int((sig_df['regla']=='R1').sum())
    stats['r2']        = int((sig_df['regla']=='R2').sum())
    stats['r3']        = int((sig_df['regla']=='R3').sum())
    stats['r4']        = int((sig_df['regla']=='R4').sum())
    stats['total_sig'] = len(sig_df)

    print('\n[4/5] Generando visualizaciones...')
    graficar_carta_p(trim, p_bar, stats, sig_df,
                     'altB_carta_p.png', dpi=args.dpi)
    graficar_nelson(trim, p_bar, stats, sig_df,
                    'altB_nelson.png',   dpi=args.dpi)
    graficar_estadisticos(trim, p_bar, stats, df_raw,
                          'altB_estadisticos.png', dpi=args.dpi)

    print('\n[5/5] Exportando datos...')
    exportar(trim, sig_df, stats)

    print(f'\n{sep}')
    print('  RESUMEN FINAL')
    print(sep)
    print(f"  CL (p̄)          : {p_bar:.4f}  ({p_bar:.2%})")
    print(f"  UCL̄ (±3σ media)  : {stats['UCL_mean']:.4f}  ({stats['UCL_mean']:.2%})")
    print(f"  LCL̄ (±3σ media)  : {stats['LCL_mean']:.4f}  ({stats['LCL_mean']:.2%})")
    print(f"  σ̄                : {stats['sigma_bar']:.4f}")
    print(f"  CV               : {stats['cv']:.4f}  ({stats['cv']:.2%})")
    print(f"  Señales R1       : {stats['r1']} / {stats['n_subgroups']}")
    print(f"  Señales totales  : {stats['total_sig']}"
          f"  (R1:{stats['r1']} R2:{stats['r2']} R3:{stats['r3']} R4:{stats['r4']})")
    diag = ('✔ PROCESO BAJO CONTROL' if stats['r1'] == 0
            else '⚠ PROCESO FUERA DE CONTROL')
    print(f"  Diagnóstico      : {diag}")
    print()
    for f in ['altB_carta_p.png','altB_nelson.png','altB_estadisticos.png',
              'baseline_altB.csv','signals_altB.csv','stats_altB.json']:
        print(f"    ✔ {f}")
    print(sep)


if __name__ == '__main__':
    main()
