"""
CMMI Models API — microservicio FastAPI.

Ejecuta los modelos PPB/PPM de las áreas COMERCIAL y PROYECTOS.

Arranque:
    cd services/cmmi-api
    "C:/ProgramData/anaconda3/python.exe" -m uvicorn main:app --port 8008
"""

from __future__ import annotations
import io
from pathlib import Path
from typing import Annotated

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from prep import curate_comercial
from runner import execute, SCRIPTS_DIR, STORE_DIR
import proyectos as proy
import financiero as fin
import datos as dat
import comercial as com
import cpi

app = FastAPI(title="CMMI Models API", version="1.0.0")

# El proxy de Next llama server-side; CORS abierto para dev local.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

BUNDLED_PKL = SCRIPTS_DIR / "modelo_rf_v2.pkl"
STORED_PKL  = STORE_DIR / "modelo_rf_v2.pkl"


def _leer_excel(upload: UploadFile, curar: bool = True) -> tuple[pd.DataFrame, dict]:
    if not upload.filename or not upload.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Se requiere un archivo .xlsx/.xls")
    raw = upload.file.read()
    try:
        df = pd.read_excel(io.BytesIO(raw))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"No se pudo leer el Excel: {e}")
    if not curar:
        return df, {"registros_incluidos": len(df)}
    df_c, meta = curate_comercial(df)
    if len(df_c) == 0:
        raise HTTPException(422, "Tras la curación no quedaron registros válidos.")
    return df_c, meta


# ── Schemas Proyectos ──────────────────────────────────────────────────
class KickoffInput(BaseModel):
    portafolio:     str
    lider:          str
    duracion_meses: float = Field(..., gt=0)
    presupuesto:    float | None = None

class CpiPredecirInput(BaseModel):
    portafolio:      str
    lider:           str
    duracion_meses:  float = Field(..., gt=0)
    presupuesto:     float | None = None
    cpi_m1:          float
    spi_m1:          float
    va_m1:           float

class CpiDiagnosticoInput(BaseModel):
    portafolio:  str
    mes_rel:     float = Field(..., ge=0.0, le=1.0)
    spi:         float
    cpi:         float
    va:          float
    proyecto_id: str = "N/A"

class SeguimientoInput(BaseModel):
    portafolio:    str
    lider:         str
    mes_rel:       float = Field(..., ge=0.0, le=1.0)
    spi_lag1:      float
    vra_lag1:      float
    spi_lag2:      float | None = None
    spi_observado: float | None = None


@app.get("/health")
def health() -> dict:
    return {
        "status":              "ok",
        "service":             "cmmi-models",
        "modelo_rf_entrenado": STORED_PKL.exists(),
        "pkl_bundled":         BUNDLED_PKL.exists(),
        "proyectos":           proy.status(),
        "financiero":          fin.status(),
        "datos":               dat.status(),
    }


class PredictOneInput(BaseModel):
    comercial:   str
    linea:       str
    tipo_venta:  str
    segmento:    str
    ingreso_cop: float = Field(..., gt=0)


@app.get("/comercial/rf/info")
def comercial_rf_info() -> dict:
    """Metadatos completos del PKL: métricas, features, importancia de variables."""
    return com.info()


@app.get("/comercial/rf/status")
def comercial_rf_status() -> dict:
    """Opciones disponibles para predicción individual (clases del encoder)."""
    return com.status()


@app.post("/comercial/rf/predict-one")
def comercial_rf_predict_one(body: PredictOneInput) -> dict:
    """Predice la probabilidad de ganar una oportunidad individual."""
    try:
        return com.predict_one(
            body.comercial, body.linea, body.tipo_venta,
            body.segmento, body.ingreso_cop,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.post("/comercial/spc")
def comercial_spc(
    file: UploadFile = File(...),
    year_from: Optional[int] = Form(None),
    year_to:   Optional[int] = Form(None),
) -> dict:
    """SPC — Carta de Control P (v2 altA, Win Rate competitivo, base Fase 2)."""
    df, meta = _leer_excel(file)
    if "Fecha Final" in df.columns:
        fechas = pd.to_datetime(df["Fecha Final"], errors="coerce")
        if year_from is not None:
            df = df[fechas.dt.year >= year_from]
        if year_to is not None:
            df = df[fechas.dt.year <= year_to]
    out = execute(
        "spc_baseline_altA.py", df,
        images={
            "carta_p":      "f2_carta_p.png",
            "nelson":       "f2_nelson.png",
            "estadisticos": "f2_estadisticos.png",
        },
        csvs={"baseline": "baseline_altA.csv", "signals": "signals_altA.csv"},
        jsons={"resumen": "stats_altA.json"},
    )
    if not out["ok"]:
        raise HTTPException(500, f"SPC falló: {out['stderr'][-1500:]}")
    out["curacion"] = meta
    return out


@app.post("/comercial/rf/train")
def comercial_rf_train(file: UploadFile = File(...)) -> dict:
    """Random Forest v2 — entrena, evalúa (5-fold CV) y persiste el modelo."""
    df, meta = _leer_excel(file)
    out = execute(
        "modelo_random_forest_v2.py", df,
        extra_args=["--modo", "entrenar"],
        images={
            "dashboard":    "rf_dashboard.png",
            "comercial":    "rf_comercial_analysis.png",
            "interactions": "rf_interactions.png",
        },
        csvs={"predictions": "predictions_v2.csv"},
        jsons={"metrics": "model_metrics_v2.json"},
        keep_outputs=["modelo_rf_v2.pkl"],
    )
    if not out["ok"]:
        raise HTTPException(500, f"Entrenamiento RF falló: {out['stderr'][-1500:]}")
    out["curacion"] = meta
    return out


# ── PROYECTOS ──────────────────────────────────────────────────────────
@app.get("/proyectos/info")
def proyectos_info() -> dict:
    """Metadatos completos de los 4 PKLs cargados: métricas, features, importancia."""
    return proy.info_modelos()


@app.post("/proyectos/reentrenar")
def proyectos_reentrenar(file: UploadFile = File(...)) -> dict:
    """Recibe el Excel histórico actualizado, reentrena los 4 modelos y recarga los PKLs."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Se requiere un archivo .xlsx/.xls")
    try:
        return proy.reentrenar(file.file.read())
    except ValueError as e:
        raise HTTPException(422, str(e))
    except RuntimeError as e:
        raise HTTPException(500, str(e))


@app.post("/proyectos/kickoff")
def proyectos_kickoff(body: KickoffInput) -> dict:
    """Modelo Kickoff + Modelo A — evaluación de riesgo en el inicio del proyecto."""
    try:
        return proy.predecir_kickoff(
            body.portafolio, body.lider,
            body.duracion_meses, body.presupuesto,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.get("/proyectos/lineas-base")
def proyectos_lineas_base() -> dict:
    """Línea base SPI completa: CL/UCL/LCL por portafolio y fase de avance."""
    try:
        return proy.lineas_base_spi()
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.post("/proyectos/seguimiento")
def proyectos_seguimiento(body: SeguimientoInput) -> dict:
    """Modelo 1 + Modelo 2 + Línea Base SPI — seguimiento mensual."""
    try:
        return proy.predecir_seguimiento(
            body.portafolio, body.lider, body.mes_rel,
            body.spi_lag1, body.vra_lag1,
            body.spi_lag2, body.spi_observado,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


# ── PROYECTOS CPI ─────────────────────────────────────────────────────
@app.get("/proyectos/cpi/info")
def proyectos_cpi_info() -> dict:
    """Metadatos del modelo CPI y estado de las líneas base."""
    return cpi.info_cpi()


@app.get("/proyectos/cpi/lineas-base")
def proyectos_cpi_lineas_base() -> dict:
    """Líneas base CPI (+ SPI, VA) por portafolio y decil de avance."""
    try:
        return cpi.lineas_base_cpi()
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.post("/proyectos/cpi/diagnostico")
def proyectos_cpi_diagnostico(body: CpiDiagnosticoInput) -> dict:
    """Diagnóstico SPC en tiempo real: semáforo por SPI, CPI y VA."""
    try:
        return cpi.diagnostico(
            body.portafolio, body.mes_rel,
            body.spi, body.cpi, body.va, body.proyecto_id,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.post("/proyectos/cpi/predecir")
def proyectos_cpi_predecir(body: CpiPredecirInput) -> dict:
    """Predicción de riesgo de costo (P(CPI_min < 0.80)) con nivel BAJO/MODERADO/ALTO."""
    try:
        return cpi.predecir_cpi(
            body.portafolio, body.lider, body.duracion_meses,
            body.presupuesto, body.cpi_m1, body.spi_m1, body.va_m1,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


# ── FINANCIERO ────────────────────────────────────────────────────────

class PrediccionInput(BaseModel):
    categoria: str
    monto_cop: float = Field(..., gt=0)


@app.get("/financiero/info")
def financiero_info() -> dict:
    """Resumen de los datos de entrenamiento del modelo de financiero."""
    return fin.info_financiero()


@app.post("/financiero/cargar")
def financiero_cargar(file: UploadFile = File(...)) -> dict:
    """Carga un nuevo Excel de utilidad y reajusta el modelo en memoria."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Se requiere un archivo .xlsx/.xls")
    try:
        return fin.recargar(file.file.read())
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error al recargar: {e}")


@app.get("/financiero/lineas-base")
def financiero_lineas_base(
    year_from: Optional[int] = None,
    year_to:   Optional[int] = None,
) -> dict:
    """Líneas base globales y por categoría (SPC + Nelson) desde datos históricos."""
    try:
        return fin.lineas_base(year_from=year_from, year_to=year_to)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.get("/financiero/comparacion")
def financiero_comparacion(
    meta:           float         = 0.008,
    base_year_from: Optional[int] = None,
    base_year_to:   Optional[int] = None,
    quarters:       Optional[str] = None,   # ej. "2026Q1,2026Q2"
) -> dict:
    """Compara utilidad media histórica (baseline) vs período seleccionado."""
    # Parsear quarters: "2026Q1,2026Q2" → [(2026,1),(2026,2)]
    parsed_quarters: list[tuple[int, int]] = []
    if quarters:
        for tok in quarters.split(","):
            tok = tok.strip()
            if "Q" in tok:
                y, q = tok.split("Q", 1)
                try:
                    parsed_quarters.append((int(y), int(q)))
                except ValueError:
                    pass
    try:
        return fin.comparacion(
            meta_delta=meta,
            base_year_from=base_year_from,
            base_year_to=base_year_to,
            compare_quarters=parsed_quarters or None,
        )
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.post("/financiero/lineas-base-excel")
def financiero_lineas_base_excel(
    file:      Optional[UploadFile] = File(None),
    year_from: Optional[int]        = Form(None),
    year_to:   Optional[int]        = Form(None),
) -> dict:
    """Líneas base desde Excel subido (file) o desde _df en memoria (sin file)."""
    try:
        if file is not None:
            import io
            data = file.file.read()
            df = pd.read_excel(io.BytesIO(data))
            df = fin._fix_cols(df)
            requeridas = {"Utilidad del proyecto", "Categoría de proyecto"}
            faltantes = requeridas - set(df.columns)
            if faltantes:
                raise HTTPException(400, f"Columnas faltantes: {faltantes}")
            df = df.dropna(subset=["Utilidad del proyecto"])
            df["Cat"] = df["Categoría de proyecto"].apply(fin._norm)
        else:
            if fin._df is None:
                raise HTTPException(503, "Datos de Financiero no disponibles.")
            df = fin._df.copy()

        # Filtro por año — búsqueda insensible a mayúsculas/minúsculas
        fecha_col = next((c for c in df.columns if "finaliz" in c.lower()), None)
        if fecha_col:
            fechas = pd.to_datetime(df[fecha_col], errors="coerce")
            mask = pd.Series([True] * len(df), index=df.index)
            if year_from is not None:
                mask &= fechas.dt.year >= year_from
            if year_to is not None:
                mask &= fechas.dt.year <= year_to
            df = df[mask]

        if df.empty:
            raise HTTPException(400, "Sin datos en el rango de años indicado.")

        g_block = fin._stats_block(df["Utilidad del proyecto"].values)
        counts = df["Cat"].value_counts()
        cats_validas = counts[counts >= fin.N_MIN].index.tolist()
        por_cat = {cat: fin._stats_block(df[df["Cat"] == cat]["Utilidad del proyecto"].values)
                   for cat in cats_validas}
        return {"global": g_block, "por_categoria": por_cat, "categorias_disponibles": cats_validas}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error al procesar: {e}")


@app.post("/financiero/predecir")
def financiero_predecir(body: PrediccionInput) -> dict:
    """Predicción de utilidad via OLS (Modelo B, sin outliers |z|>2.5)."""
    try:
        return fin.predecir_utilidad(body.categoria, body.monto_cop)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


# ── DATOS (Gobierno de Datos) ──────────────────────────────────────────

class DatosPrediccionInput(BaseModel):
    categoria: str
    periodo:   int = Field(..., ge=1)


@app.post("/datos/cargar")
def datos_cargar(file: UploadFile = File(...)) -> dict:
    """Carga un nuevo Excel de GobiernoDatos y reajusta el modelo en memoria."""
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Se requiere un archivo .xlsx/.xls")
    try:
        return dat.recargar(file.file.read())
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error al recargar: {e}")


@app.get("/datos/info")
def datos_info() -> dict:
    """Resumen del Excel de entrenamiento de Gobierno de Datos."""
    return dat.info_datos()


@app.get("/datos/lineas-base")
def datos_lineas_base() -> dict:
    """Líneas base SPC (CL/UCL/LCL/σ) por categoría y período."""
    try:
        return dat.lineas_base()
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.post("/datos/lineas-base-excel")
def datos_lineas_base_excel(file: UploadFile = File(...)) -> dict:
    """Calcula líneas base (CL global + por categoría) desde un Excel subido sin persistirlo."""
    try:
        return dat.lineas_base_desde_bytes(file.file.read())
    except Exception as e:
        raise HTTPException(500, f"Error al procesar el archivo: {e}")


@app.post("/datos/predecir")
def datos_predecir(body: DatosPrediccionInput) -> dict:
    """Modelo cuadrático Ĉ = β₀ + β_cat + β₁·P + β₂·P² con IC 95%."""
    try:
        return dat.predecir(body.categoria, body.periodo)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@app.post("/comercial/rf/predict")
def comercial_rf_predict(file: UploadFile = File(...)) -> dict:
    """Predice prob_ganado sobre oportunidades nuevas usando el modelo persistido."""
    df, meta = _leer_excel(file, curar=False)
    pkl = STORED_PKL if STORED_PKL.exists() else BUNDLED_PKL
    if not pkl.exists():
        raise HTTPException(409, "No hay modelo disponible. Entrena primero con /comercial/rf/train.")
    out = execute(
        "modelo_random_forest_v2.py", df,
        extra_args=["--modo", "predecir", "--nuevos", "Oportunidades.xlsx",
                    "--modelo", pkl.name],
        csvs={"predictions": "predictions_v2.csv"},
        extra_inputs=[pkl],
        csv_limit=1000,
    )
    if not out["ok"]:
        raise HTTPException(500, f"Predicción RF falló: {out['stderr'][-1500:]}")
    out["modelo_usado"] = "entrenado" if pkl == STORED_PKL else "bundled"
    out["registros"] = meta.get("registros_incluidos")
    return out
