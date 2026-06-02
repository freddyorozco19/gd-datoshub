"""
Curación del dataset COMERCIAL.

Reproduce el filtro documentado en 'Filtros Datos.txt':
    - Se eliminan las oportunidades 'Pendiente' (el análisis se enfoca en
      resultados: Ganado / Perdido / Declinada).
    - Se eliminan filas sin Ingreso esperado, Tipo de Venta o Segmento
      (el modelo RF los usa como predictores).

Entrada: export crudo (42 columnas) o un Excel ya curado (idempotente).
Salida:  DataFrame canónico (~929 registros) listo para los scripts.
"""

from __future__ import annotations
import pandas as pd

REQUIRED_FOR_RF = ["Ingreso esperado", "Tipo de Venta", "Segmento"]


def curate_comercial(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    d = df.copy()
    n_inicial = len(d)

    # Normalizar celdas de texto vacías → NaN (solo columnas tipo objeto)
    for col in REQUIRED_FOR_RF:
        if col in d.columns and d[col].dtype == object:
            d[col] = d[col].replace(r"^\s*$", pd.NA, regex=True)

    # 1) Quitar Pendientes
    n_pendientes = 0
    if "Ganado" in d.columns:
        mask_pend = d["Ganado"].astype(str).str.strip().str.upper() == "PENDIENTE"
        n_pendientes = int(mask_pend.sum())
        d = d[~mask_pend]

    # 2) Quitar filas sin Ingreso / Tipo de Venta / Segmento
    presentes = [c for c in REQUIRED_FOR_RF if c in d.columns]
    n_antes_na = len(d)
    if presentes:
        d = d.dropna(subset=presentes)
    n_sin_campos = n_antes_na - len(d)

    d = d.reset_index(drop=True)

    meta = {
        "registros_iniciales": n_inicial,
        "eliminados_pendientes": n_pendientes,
        "eliminados_sin_campos": n_sin_campos,
        "registros_incluidos": len(d),
    }
    return d, meta
