"use client";

import { useMemo, useRef, useState } from "react";
import {
  ShieldCheck, Upload, FileSpreadsheet, X, Search,
  DollarSign, Trophy, TrendingDown, Clock, Layers, AlertCircle,
  Table2, Activity, Cpu, Play, Maximize2, Filter,
  BarChart2, CalendarCheck, TrendingUp, PieChart, Database, LineChart,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import {
  VERTICALES, type Vertical, type OportunidadComercial, type ParseResult,
  type SpcResponse, type RfTrainResponse, type CuracionMeta,
  type KickoffResponse, type SeguimientoResponse, type SemaforoProy, type LineaBaseSpi,
  type LineasBaseResponse, type PrediccionFinResponse, type LineaBaseBloque,
  type LineasBaseDatosResponse, type PrediccionDatosResponse,
  type ProyectosInfoResponse, type PklBloque,
  type DatosOrigen, type DatosOrigenProyecto,
  type FinancieroInfoResponse, type FinancieroInfoProyecto,
  type DatosInfoResponse, type DatosInfoRegistro,
  type RfStatusResponse, type PredictOneResponse,
} from "@/lib/cmmi/types";
import { parseComercialWorkbook } from "@/lib/cmmi/parseComercial";

/* ── Helpers ───────────────────────────────────────────────────────── */
const fmtCOP = (v: number): string =>
  v ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v) : "—";

const fmtCompact = (v: number): string => {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000)     return `$${(v / 1_000_000).toFixed(0)}M`;
  if (v >= 1_000)         return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v}`;
};

const fmtDate = (s: string): string => (s ? s.substring(0, 10) : "—");

function estadoBadge(g: string): string {
  const k = g.toUpperCase();
  if (k.startsWith("GANAD"))    return "bg-emerald-500/10 text-emerald-400";
  if (k.startsWith("PERDID"))   return "bg-rose-500/10 text-rose-400";
  if (k.startsWith("DECLINAD")) return "bg-white/[0.05] text-slate-400";
  return "bg-amber-500/10 text-amber-400";
}

function lineaBadge(l: string): string {
  const k = l.toUpperCase();
  if (k.startsWith("CONSULTOR")) return "bg-violet-500/10 text-violet-400";
  if (k === "TI")                return "bg-sky-500/10 text-sky-400";
  if (k.startsWith("DATOS"))     return "bg-emerald-500/10 text-emerald-400";
  return "bg-white/[0.05] text-slate-400";
}

/* ── Marco de Medición — tabla de indicadores por área ─────────────── */
type IndicadorRow = { indicador: string; construccion: string; tipo: "Sub-proceso" | "Contexto"; origen: "Calculado" | "Input"; relevancia: string; descripcion: string };
type MarcoArea = { qppo: string; metrica: string; modelo: string; indicadores: IndicadorRow[] };

const MARCO: Record<"comercial" | "proyectos" | "financiero" | "datos", MarcoArea> = {
  comercial: {
    qppo: "Win Rate ≥ 44.4%",
    metrica: "Ganadas / (Ganadas + Perdidas) · excluye Declinadas",
    modelo: "Random Forest v2 · AUC = 0.804 · 596 oportunidades",
    indicadores: [
      { indicador: "Ejecutivo comercial",    construccion: "Quién lleva la oportunidad",             tipo: "Sub-proceso", origen: "Input",     relevancia: "Importancia 0.248 — predictor #1",
        descripcion: "Es el predictor más importante del modelo con una importancia de 0.248. Existen diferencias de hasta 70 puntos porcentuales en win rate entre ejecutivos. Captura el efecto sistemático de la calidad de gestión, la red de relaciones y la experiencia del comercial. El modelo aprende el historial estadístico de cada uno y ajusta la probabilidad de ganar según quién lleva la oportunidad." },
      { indicador: "Ingreso esperado (log)", construccion: "Valor COP transformado logarítmicamente", tipo: "Sub-proceso", origen: "Calculado", relevancia: "Importancia 0.123 — predictor #2",
        descripcion: "Segundo predictor en importancia (0.123). Presenta una relación inversa no lineal: deals más pequeños tienen mayor probabilidad de ganar, posiblemente por menor competencia y menores requisitos técnicos. Se aplica transformación log(1+x) para comprimir el rango extremo de $1M a $59B y evitar que valores atípicos distorsionen el modelo." },
      { indicador: "Tipo de venta",          construccion: "PROPIO vs REFERENCIADO",                  tipo: "Contexto",    origen: "Input",     relevancia: "Importancia 0.073 — referido gana +10pp",
        descripcion: "Indica el origen del lead. Los leads referenciados ganan en promedio 10 puntos porcentuales más que los propios. Aunque individualmente tiene AUC univariado de solo 0.55, su poder real emerge en combinación con el ejecutivo comercial y el segmento, lo que justifica su inclusión en el Random Forest." },
      { indicador: "Línea de negocio",       construccion: "TI / Datos y SI / Consultoría",           tipo: "Contexto",    origen: "Input",     relevancia: "Importancia 0.032",
        descripcion: "Diferencia el área de solución ofrecida. TI tiene el win rate más alto (51.5%), seguido de Datos y SI (48.2%) y Consultoría (41.4%). Su función principal en el modelo es capturar fortalezas diferenciadas por ejecutivo: ciertos comerciales son significativamente mejores en TI que en Consultoría, lo que el modelo detecta a través de la interacción entre variables." },
      { indicador: "Segmento",               construccion: "PÚBLICO vs PRIVADO",                      tipo: "Contexto",    origen: "Input",     relevancia: "Importancia 0.023",
        descripcion: "Sin poder predictivo individual (AUC univariado 0.52), su valor está en las interacciones: Privado + Referenciado es la combinación de mayor win rate esperado (~50%), mientras que Público + Propio es la de menor probabilidad. El Random Forest capta estas interacciones automáticamente sin necesidad de codificarlas manualmente." },
    ],
  },
  proyectos: {
    qppo: "SPI ≥ 0.9301",
    metrica: "EV / PV (Earned Value / Planned Value) — promedio mensual",
    modelo: "Regresión logística · Modelo 1 AUC=0.88 · Modelo 2 AUC=0.85",
    indicadores: [
      { indicador: "SPI_lag2",     construccion: "SPI de hace 2 meses — shift(2) sobre histórico",        tipo: "Sub-proceso", origen: "Calculado", relevancia: "β = −1.45 — predictor más fuerte",
        descripcion: "El predictor con mayor peso absoluto en ambos modelos (β=−1.45 en M2, β=−1.22 en M1). El historial de 2 meses es más predictivo que el estado actual porque revela si el deterioro tiene profundidad o si es puntual. Proyectos con buen SPI hace 2 meses tienen riesgo significativamente menor aunque estén bajos ahora. El modelo lo deriva aplicando shift(2) sobre la serie histórica mensual de SPI." },
      { indicador: "SPI_lag1",     construccion: "SPI del mes anterior — shift(1) sobre histórico",        tipo: "Sub-proceso", origen: "Calculado", relevancia: "β = −1.28",
        descripcion: "Estado actual del cronograma. Un SPI bajo el mes anterior es señal directa de que el proyecto ya está deteriorado. Se calcula con shift(1) sobre la serie mensual. Su coeficiente (β=−1.28) indica que por cada unidad que baja el SPI del mes anterior, la probabilidad logarítmica de alerta aumenta 1.28 unidades, manteniendo constantes las demás variables." },
      { indicador: "VRA_lag1",     construccion: "(% Real − % Plan) / |% Plan| del mes anterior",          tipo: "Sub-proceso", origen: "Calculado", relevancia: "β = −1.28 — igual de predictivo que SPI",
        descripcion: "Variación Relativa de Avance: cuantifica la brecha porcentual entre el avance real y el planeado, normalizada por el planeado. Con el mismo coeficiente que SPI_lag1 (β=−1.28), confirma empíricamente que no es redundante sino complementaria: mide el deterioro desde la perspectiva del avance físico en lugar de la eficiencia de valor ganado. Un proyecto puede tener VRA negativa con SPI aceptable o viceversa." },
      { indicador: "SPI_trend",    construccion: "SPI_lag1 − SPI_lag2 (derivado en el pipeline)",          tipo: "Sub-proceso", origen: "Calculado", relevancia: "β = −0.35 — dirección del cambio",
        descripcion: "Captura la dirección del cambio en el cronograma. Un SPI de 0.88 bajando (trend negativo) es fundamentalmente distinto a un SPI de 0.88 subiendo (trend positivo). El modelo lo calcula restando los dos rezagos disponibles. Aunque su coeficiente (β=−0.35) es menor que los lags, aporta información que el nivel puntual no puede dar: si el proyecto está mejorando o empeorando." },
      { indicador: "VRA_trend",    construccion: "VRA_lag1 − VRA_lag2 (derivado en el pipeline)",          tipo: "Sub-proceso", origen: "Calculado", relevancia: "β = −0.35 — tendencia de la brecha",
        descripcion: "Análogo al SPI_trend pero para la brecha de avance. Detecta si la diferencia entre lo planeado y lo ejecutado está creciendo o reduciéndose. Complementa al VRA_lag1 de la misma forma que SPI_trend complementa a SPI_lag1: el nivel dice dónde está el proyecto, el trend dice hacia dónde va." },
      { indicador: "Mes relativo", construccion: "Fase del ciclo de vida normalizada [0–1]",               tipo: "Contexto",    origen: "Calculado", relevancia: "β = −0.62",
        descripcion: "Indica en qué fracción del ciclo de vida está el proyecto (0=inicio, 1=cierre). Es esencial para eliminar falsas alarmas: un SPI de 0.88 en la fase 30–40% de un proyecto TI es históricamente normal, pero el mismo valor en la fase 80–90% es crítico. Sin esta variable el modelo generaría alertas masivas en fases donde el deterioro temporal es parte del patrón esperado del proceso." },
      { indicador: "Portafolio",   construccion: "DATOS Y SI / TI / CONSULTORÍA",                          tipo: "Contexto",    origen: "Input",     relevancia: "β = −0.03",
        descripcion: "Controla las diferencias estructurales de riesgo entre portafolios. TI es el más volátil (19 secuencias R2 de Nelson en VRA), mientras que DATOS Y SI es el más predecible al cierre (σ=0.062 en fase 90–100%). Sin este control, el modelo aplicaría los mismos umbrales a portafolios con perfiles de riesgo históricamente distintos, generando alertas incorrectas." },
      { indicador: "Líder",        construccion: "Codificación ordinal del líder del proyecto",             tipo: "Contexto",    origen: "Input",     relevancia: "β = +0.04",
        descripcion: "Único coeficiente positivo en el Modelo 1 (+0.04), lo que significa que ciertos líderes están sistemáticamente asociados con mayor riesgo de alerta. Permite al modelo separar el riesgo inherente al tipo de proyecto del riesgo atribuible a la capacidad de gestión del líder. La codificación ordinal preserva el orden de desempeño histórico entre líderes." },
    ],
  },
  financiero: {
    qppo: "Utilidad ≥ 18.40%",
    metrica: "Utilidad del proyecto (%) — proyectos terminados sin outliers |z|>2.5",
    modelo: "OLS Regresión Lineal Modelo B · R²adj=16.3% · RMSE=8.79% · n=62",
    indicadores: [
      { indicador: "Categoría del proyecto", construccion: "13 tipos codificados como variables dummy",   tipo: "Sub-proceso", origen: "Input", relevancia: "Sostenibilidad β=+0.31 (p=0.005); Infra β=+0.18 (p=0.022)",
        descripcion: "Principal discriminador del modelo. Cada una de las 13 categorías recibe un coeficiente β que representa su desviación respecto al nivel base (Arquitectura Empresarial, 14.29%). Sostenibilidad es la categoría más rentable con utilidad esperada de 44.84% (p=0.005), seguida de Infra + Servicios gestionados con 32.55% (p=0.022). Gobierno de Datos es la de menor utilidad esperada (0.92%, β=−0.134). La categoría es el factor más accionable en el proceso de cotización." },
      { indicador: "Monto contratado",       construccion: "Valor del contrato en miles de millones COP", tipo: "Contexto",    origen: "Input", relevancia: "β=−0.0003 (p=0.955 — no significativo en Modelo B)",
        descripcion: "En el Modelo A (con outliers, n=64) el monto era significativo (p=0.044), pero al excluir 2 proyectos con |z|>2.5, pierde toda significancia (p=0.955). Este hallazgo es intencionalmente documentado: revela que eran esos dos proyectos los que generaban artificialmente la relación. La conclusión es que con los datos actuales no se puede afirmar que proyectos más grandes o más pequeños tengan sistemáticamente mayor o menor utilidad." },
    ],
  },
  datos: {
    qppo: "Cobertura global ≥ 91.89%",
    metrica: "Promedio de cubrimiento de indicadores de Gobierno de Datos por período",
    modelo: "Regresión cuadrática · Ĉ = β₀ + β_cat + β₁·P + β₂·P² · 10 períodos",
    indicadores: [
      { indicador: "Calidad de datos",      construccion: "Promedio de cubrimiento agrupado por período", tipo: "Sub-proceso", origen: "Calculado", relevancia: "CL=96.2% · σ=0.047 — tendencia ascendente ↑",
        descripcion: "Mide la integridad y confiabilidad del dato en origen. Es la dimensión más madura del programa: muestra una tendencia claramente ascendente de P1 a P10 y tiene la desviación estándar más baja de las 4 categorías (σ=0.047), lo que indica un proceso estable y predecible. El modelo calcula su cubrimiento promediando todas las variables de calidad registradas en cada período." },
      { indicador: "Uso y acceso a datos",  construccion: "Promedio de cubrimiento agrupado por período", tipo: "Sub-proceso", origen: "Calculado", relevancia: "CL=95.1% · σ=0.035 — más estable",
        descripcion: "Mide la disponibilidad y el control de acceso al dato. Es la categoría más estable del programa (σ=0.035, la más baja), con un crecimiento constante de 88.7% en P1 hasta 98.7% en P10. Su alta predictibilidad hace que el modelo polinomial tenga un R²=0.870 para esta categoría, el más alto de las cuatro." },
      { indicador: "Integración y flujo",   construccion: "Promedio de cubrimiento agrupado por período", tipo: "Sub-proceso", origen: "Calculado", relevancia: "CL=90.5% · σ=0.089 — caída en P9→P10 ⚠",
        descripcion: "Mide la conectividad y el flujo de datos entre sistemas. Es la categoría con la alerta activa más urgente: muestra una tendencia descendente sostenida desde P7 hasta P10, con P10=74.5%, la lectura más baja reciente en todo el programa. Su σ=0.089 es mayor que Calidad y Uso-Acceso, reflejando mayor volatilidad. El modelo proyecta P11=73.9%, lo que requiere intervención inmediata." },
      { indicador: "Gestión ciclo de vida", construccion: "Promedio de cubrimiento agrupado por período", tipo: "Sub-proceso", origen: "Calculado", relevancia: "CL=88.7% · σ=0.141 — mayor riesgo",
        descripcion: "Mide el control del dato a lo largo de su ciclo completo: creación, almacenamiento, uso y eliminación. Es la categoría de mayor riesgo: tiene la σ más alta (0.141) y el LCL más bajo (46.5%), lo que indica alta dispersión entre sus 6 variables internas. El Modelo Mixto (efectos fijos por período + efectos aleatorios por categoría) es el que mejor ajusta esta serie por su comportamiento irregular." },
      { indicador: "Período",               construccion: "Número de período histórico (P1–P10)",          tipo: "Contexto",    origen: "Input",     relevancia: "Coeficiente β lineal + β cuadrático",
        descripcion: "Captura la evolución temporal del programa. El modelo usa dos términos: β₁·P (tendencia lineal, β₁=+0.0231) que refleja el crecimiento sostenido, y β₂·P² (curvatura, β₂=−0.0020) que captura la desaceleración natural conforme el cubrimiento se aproxima al techo del 100%. Sin el término cuadrático, el modelo sobreestimaría el crecimiento futuro. Esta es la justificación metodológica para usar regresión polinomial en lugar de lineal simple." },
    ],
  },
};

function MarcoMedicion({ area }: { area: keyof typeof MARCO }) {
  const m = MARCO[area];
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      {/* Encabezado QPPO */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">QPPO</p>
        <p className="text-2xl font-bold text-slate-100">{m.qppo}</p>
        <p className="text-xs text-slate-400">{m.metrica}</p>
        <div className="pt-1 border-t border-white/[0.06]">
          <p className="text-xs text-slate-500">{m.modelo}</p>
        </div>
      </div>

      {/* Tabla de indicadores */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.07]">
          <p className="text-sm font-semibold text-slate-200">Indicadores involucrados en el modelo</p>
          <p className="text-xs text-slate-500 mt-0.5">Haz clic en <AlertCircle size={11} className="inline text-slate-500" /> para ver la función e importancia de cada variable</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">Indicador</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">Construcción</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">Tipo</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">Origen</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-slate-500">Relevancia</th>
              </tr>
            </thead>
            <tbody>
              {m.indicadores.map((row, i) => (
                <>
                  <tr
                    key={i}
                    className={`border-b border-white/[0.04] last:border-0 transition-colors cursor-pointer ${openIdx === i ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"}`}
                    onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-200 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {row.indicador}
                        <AlertCircle size={13} className={`shrink-0 transition-colors ${openIdx === i ? "text-blue-400" : "text-slate-600 hover:text-slate-400"}`} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.construccion}</td>
                    <td className="px-4 py-3">
                      {row.tipo === "Sub-proceso"
                        ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 whitespace-nowrap">Sub-proceso</span>
                        : <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 whitespace-nowrap">Contexto</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {row.origen === "Calculado"
                        ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-violet-500/10 text-violet-400 whitespace-nowrap">Calculado</span>
                        : <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 whitespace-nowrap">Input</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{row.relevancia}</td>
                  </tr>
                  {openIdx === i && (
                    <tr key={`desc-${i}`} className="border-b border-white/[0.04]">
                      <td colSpan={5} className="px-4 pb-4 pt-0">
                        <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg px-4 py-3 text-xs text-slate-300 leading-relaxed">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-400 mb-1.5">Función e importancia</p>
                          {row.descripcion}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-400">Sub-proceso</span>
          Métrica que mide directamente la ejecución del proceso
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-400">Contexto</span>
          Variable de clasificación o atributo del ambiente
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-violet-500/10 text-violet-400">Calculado</span>
          El modelo lo deriva internamente desde los datos históricos
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-500/10 text-slate-400">Input</span>
          Viene directamente del sistema origen (Excel / CRM)
        </div>
      </div>
    </div>
  );
}

/* ── KPI card ──────────────────────────────────────────────────────── */
function Kpi({ icon: Icon, label, value, tint }: {
  icon: typeof DollarSign; label: string; value: string; tint: string;
}) {
  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-4 flex items-center gap-3">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${tint}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-200 leading-tight truncate" title={value}>{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/* ── Dropzone de carga ─────────────────────────────────────────────── */
function UploadZone({ onFile, loading, error }: {
  onFile: (f: File) => void; loading: boolean; error: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div className="max-w-xl mx-auto mt-10">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 cursor-pointer transition-colors ${
          drag
            ? "border-blue-500/60 bg-blue-500/5"
            : "border-white/[0.10] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
        }`}
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400">
          {loading ? <Clock size={26} className="animate-spin" /> : <Upload size={26} />}
        </div>
        <p className="text-sm font-semibold text-slate-300">
          {loading ? "Procesando archivo…" : "Arrastra el Excel de Comercial aquí"}
        </p>
        <p className="text-xs text-slate-500">o haz clic para seleccionar · .xlsx / .xls</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
      </div>
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
    </div>
  );
}

/* ── Helpers de modelos ────────────────────────────────────────────── */
function fmtCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") {
    if (Number.isInteger(v)) return v.toLocaleString("es-CO");
    return Math.abs(v) < 1 ? v.toFixed(4) : v.toFixed(3);
  }
  return String(v);
}

/** Imagen PNG (base64) con título y zoom a pantalla completa */
function ModelImage({ b64, title }: { b64: string | null; title: string }) {
  const [zoom, setZoom] = useState(false);
  if (!b64) return null;
  const src = `data:image/png;base64,${b64}`;
  return (
    <>
      <figure className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
        <figcaption className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
          <span className="text-xs font-semibold text-slate-400">{title}</span>
          <button onClick={() => setZoom(true)} className="text-slate-600 hover:text-slate-300 transition-colors" title="Ampliar">
            <Maximize2 size={14} />
          </button>
        </figcaption>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} className="w-full cursor-zoom-in" onClick={() => setZoom(true)} />
      </figure>
      {zoom && (
        <div onClick={() => setZoom(false)} className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6 cursor-zoom-out">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={title} className="max-h-full max-w-full rounded-lg shadow-2xl" />
          <button className="absolute top-5 right-5 text-white/60 hover:text-white"><X size={24} /></button>
        </div>
      )}
    </>
  );
}

/** Tabla genérica de registros */
function RecordTable({ rows, max = 60 }: { rows: Record<string, unknown>[] | null; max?: number }) {
  if (!rows || rows.length === 0) {
    return <p className="text-sm text-slate-500 py-6 text-center">Sin filas para mostrar.</p>;
  }
  const cols = Object.keys(rows[0]);
  const shown = rows.slice(0, max);
  return (
    <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
      <div className="overflow-auto max-h-[55vh]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="bg-black/20 backdrop-blur-md border-b border-white/[0.07]">
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {shown.map((r, i) => (
              <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                {cols.map((c) => (
                  <td key={c} className="px-3 py-1.5 text-slate-400 whitespace-nowrap tabular-nums">{fmtCell(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > max && (
        <p className="px-3 py-2 text-[11px] text-slate-600 border-t border-white/[0.05]">
          Mostrando {max} de {rows.length.toLocaleString("es-CO")} filas.
        </p>
      )}
    </div>
  );
}

/** Tarjetas con métricas escalares */
function StatCards({ stats }: { stats: Record<string, unknown> | null }) {
  if (!stats) return null;
  const entries = Object.entries(stats).filter(([, v]) => typeof v === "number" || typeof v === "string");
  if (entries.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
      {entries.map(([k, v]) => (
        <div key={k} className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-3">
          <p className="text-base font-bold text-slate-200 leading-tight truncate" title={fmtCell(v)}>{fmtCell(v)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{k}</p>
        </div>
      ))}
    </div>
  );
}

/** Resumen de la curación de datos */
function CuracionBar({ meta }: { meta: CuracionMeta }) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <Filter size={14} className="text-slate-500" />
      <span className="px-2 py-1 rounded-md bg-white/[0.05] text-slate-400">Iniciales <b>{meta.registros_iniciales.toLocaleString("es-CO")}</b></span>
      <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400">Pendientes −{meta.eliminados_pendientes}</span>
      <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-400">Sin campos −{meta.eliminados_sin_campos}</span>
      <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400">Incluidos <b>{meta.registros_incluidos.toLocaleString("es-CO")}</b></span>
    </div>
  );
}

/** Encabezado de panel de modelo con botón Ejecutar */
function RunnerHeader({ icon: Icon, title, desc, loading, done, onRun, runLabel }: {
  icon: typeof Activity; title: string; desc: string; loading: boolean; done: boolean; onRun: () => void; runLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
          <Icon size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <p className="text-xs text-slate-500 max-w-md">{desc}</p>
        </div>
      </div>
      <button
        onClick={onRun}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? <Clock size={15} className="animate-spin" /> : <Play size={15} />}
        {loading ? "Ejecutando…" : done ? "Volver a ejecutar" : (runLabel ?? "Ejecutar modelo")}
      </button>
    </div>
  );
}

/** Aviso informativo cuando la función es solo local */
function LocalOnlyNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
      <AlertCircle size={16} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-medium">Función disponible solo en entorno local</p>
        <p className="mt-0.5 text-amber-400/80">{message}</p>
      </div>
    </div>
  );
}

/** SPC Carta de Control P */
function SpcRunner({ file }: { file: File }) {
  const [res, setRes] = useState<SpcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run() {
    setError(null); setNotice(null); setLoading(true); setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const r = await fetch("/api/cmmi/comercial/spc", { method: "POST", body: fd });
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error as string); return; }
        throw new Error(json.error || `Error ${r.status}`);
      }
      setRes(json as SpcResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la ejecución del modelo SPC.");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <RunnerHeader
        icon={Activity}
        title="SPC · Carta de Control P (PPB)"
        desc="Línea base de desempeño del Win Rate competitivo por trimestre, con límites de control variables y reglas de Nelson."
        loading={loading} done={!!res} onRun={run} runLabel="Ejecutar línea base"
      />
      {notice && <LocalOnlyNotice message={notice} />}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {res && (
        <div className="space-y-4">
          <CuracionBar meta={res.curacion} />
          {/* KPI card de cobertura temporal de la data */}
          {(res.stats.resumen?.fecha_min || res.stats.resumen?.fecha_max) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">Datos desde</p>
                <p className="mt-1 text-xl font-bold text-slate-200">
                  {String(res.stats.resumen.fecha_min ?? "—")}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">Datos hasta</p>
                <p className="mt-1 text-xl font-bold text-slate-200">
                  {String(res.stats.resumen.fecha_max ?? "—")}
                </p>
              </div>
            </div>
          )}
          <StatCards stats={res.stats.resumen} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ModelImage b64={res.images.carta_p}      title="Carta de Control P" />
            <ModelImage b64={res.images.nelson}        title="Señales de Nelson" />
            <ModelImage b64={res.images.estadisticos}  title="Estadísticos descriptivos" />
          </div>
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Table2 size={15} /> Señales detectadas
              <span className="text-xs font-normal text-slate-500">({res.table_counts.signals})</span>
            </h4>
            <RecordTable rows={res.tables.signals} />
          </div>
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Table2 size={15} /> Línea base (subgrupos)
              <span className="text-xs font-normal text-slate-500">({res.table_counts.baseline})</span>
            </h4>
            <RecordTable rows={res.tables.baseline} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Random Forest v2 */
function RfRunner({ file }: { file: File }) {
  const [res, setRes] = useState<RfTrainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run() {
    setError(null); setNotice(null); setLoading(true); setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const r = await fetch("/api/cmmi/comercial/rf/train", { method: "POST", body: fd });
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error as string); return; }
        throw new Error(json.error || `Error ${r.status}`);
      }
      setRes(json as RfTrainResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló el entrenamiento del modelo Random Forest.");
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <RunnerHeader
        icon={Cpu}
        title="Random Forest v2 (PPM)"
        desc="Modelo de desempeño que estima la probabilidad de ganar una oportunidad. Entrena con validación cruzada 5-fold y persiste el modelo."
        loading={loading} done={!!res} onRun={run}
      />
      {loading && (
        <p className="text-xs text-slate-500">El entrenamiento puede tardar ~1–2 minutos…</p>
      )}
      {notice && <LocalOnlyNotice message={notice} />}
      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {res && (
        <div className="space-y-4">
          <CuracionBar meta={res.curacion} />
          <StatCards stats={res.stats.metrics} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ModelImage b64={res.images.dashboard}    title="Dashboard del modelo" />
            <ModelImage b64={res.images.comercial}     title="Análisis por comercial" />
            <ModelImage b64={res.images.interactions}  title="Interacciones" />
          </div>
          <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-300">
              <Table2 size={15} /> Predicciones
              <span className="text-xs font-normal text-slate-500">({res.table_counts.predictions})</span>
            </h4>
            <RecordTable rows={(res.tables.predictions ?? []).map((r) => ({
              ...r,
              "¿ACERTÓ?": r["GANADO_BIN"] === r["PRED_LABEL"] ? "✅ Sí" : "❌ No",
            }))} />
          </div>
        </div>
      )}
    </div>
  );
}

type ComercialTab = "datos" | "spc" | "rf" | "predictor" | "marco";

/* ── Vista COMERCIAL ───────────────────────────────────────────────── */
function PredictorOportunidad() {
  const [rfStatus, setRfStatus]   = useState<RfStatusResponse | null>(null);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState<string | null>(null);
  const [notice,   setNotice]     = useState<string | null>(null);
  const [result,   setResult]     = useState<PredictOneResponse | null>(null);

  const [comercial,  setComercial]  = useState("");
  const [linea,      setLinea]      = useState("");
  const [tipoVenta,  setTipoVenta]  = useState("");
  const [segmento,   setSegmento]   = useState("");
  const [ingreso,    setIngreso]    = useState("");

  const inputCls = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors";
  const labelCls = "text-xs font-medium text-slate-400 mb-1";

  const semBg: Record<string, string> = {
    VERDE:    "border-emerald-500/30 bg-emerald-500/10",
    AMARILLO: "border-amber-500/30   bg-amber-500/10",
    ROJO:     "border-rose-500/30    bg-rose-500/10",
  };
  const semText: Record<string, string> = {
    VERDE: "text-emerald-400", AMARILLO: "text-amber-400", ROJO: "text-rose-400",
  };

  async function loadStatus() {
    if (rfStatus) return;
    try {
      const r = await fetch("/api/cmmi/comercial/rf/status");
      const json = await r.json();
      if (json.localOnly) { setNotice(json.error); return; }
      if (json.disponible) setRfStatus(json as RfStatusResponse);
    } catch { /* sin microservicio, se usarán valores por defecto */ }
  }

  useState(() => { loadStatus(); });

  async function predecir() {
    setError(null); setResult(null); setLoading(true);
    try {
      const r = await fetch("/api/cmmi/comercial/rf/predict-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comercial:   comercial.trim() || "Desconocido",
          linea:       linea,
          tipo_venta:  tipoVenta,
          segmento:    segmento,
          ingreso_cop: parseFloat(ingreso.replace(/\./g, "").replace(",", ".")) || 0,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setResult(json as PredictOneResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al predecir.");
    } finally { setLoading(false); }
  }

  const lineas      = rfStatus?.lineas      ?? ["CONSULTORÍA", "DATOS Y SISTEMAS DE INFORMACIÓN", "TI"];
  const tiposVenta  = rfStatus?.tipos_venta ?? ["PROPIO", "REFERENCIADO"];
  const segmentos   = rfStatus?.segmentos   ?? ["PRIVADO", "PUBLICO"];
  const comerciales = rfStatus?.comerciales ?? [];

  return (
    <div className="space-y-5">
      {notice && <LocalOnlyNotice message={notice} />}

      <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Cpu size={16} className="text-indigo-400" /> Predicción de oportunidad individual
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Random Forest v2 · AUC-CV = {rfStatus?.auc_cv?.toFixed(3) ?? "0.789"} · Ingresa los datos de la oportunidad para estimar la probabilidad de ganar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className={labelCls}>Ejecutivo comercial</p>
            {comerciales.length > 0
              ? <select value={comercial} onChange={e => setComercial(e.target.value)} className={inputCls}>
                  <option value="">— Seleccionar o escribir —</option>
                  {comerciales.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              : <input value={comercial} onChange={e => setComercial(e.target.value)}
                  placeholder="Nombre del ejecutivo" className={inputCls} />
            }
          </div>

          <div>
            <p className={labelCls}>Línea de negocio</p>
            <select value={linea} onChange={e => setLinea(e.target.value)} className={inputCls}>
              <option value="">— Seleccionar —</option>
              {lineas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <p className={labelCls}>Tipo de venta</p>
            <select value={tipoVenta} onChange={e => setTipoVenta(e.target.value)} className={inputCls}>
              <option value="">— Seleccionar —</option>
              {tiposVenta.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <p className={labelCls}>Segmento</p>
            <select value={segmento} onChange={e => setSegmento(e.target.value)} className={inputCls}>
              <option value="">— Seleccionar —</option>
              {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <p className={labelCls}>Ingreso esperado (COP)</p>
            <input value={ingreso} onChange={e => setIngreso(e.target.value)}
              placeholder="Ej: 500000000" type="number" min="0" className={inputCls} />
          </div>
        </div>

        <button onClick={predecir} disabled={loading || !linea || !tipoVenta || !segmento || !ingreso}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {loading ? <Clock size={15} className="animate-spin" /> : <Play size={15} />}
          {loading ? "Calculando…" : "Predecir probabilidad"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {result && (
        <div className={`rounded-xl border p-6 space-y-4 ${semBg[result.semaforo]}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">Probabilidad de ganar</p>
              <p className={`text-5xl font-bold tabular-nums ${semText[result.semaforo]}`}>{result.probabilidad_pct}</p>
              <p className={`text-sm font-semibold mt-1 ${semText[result.semaforo]}`}>
                {result.semaforo} · Confianza {result.nivel}
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-1">
              <p>AUC-CV <span className="text-slate-300 font-mono">{result.modelo.auc_cv}</span></p>
              <p>Acc-CV <span className="text-slate-300 font-mono">{result.modelo.acc_cv}</span></p>
              <p>n entrenamiento <span className="text-slate-300 font-mono">{result.modelo.n_total}</span></p>
            </div>
          </div>

          {result.avisos.length > 0 && (
            <div className="space-y-1">
              {result.avisos.map((a, i) => (
                <p key={i} className="text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertCircle size={12} /> {a}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/[0.08]">
            {[
              { label: "Ejecutivo",  val: result.inputs.comercial },
              { label: "Línea",      val: result.inputs.linea },
              { label: "Tipo venta", val: result.inputs.tipo_venta },
              { label: "Segmento",   val: result.inputs.segmento },
            ].map(({ label, val }) => (
              <div key={label}>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
                <p className="text-xs text-slate-200 font-medium truncate">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComercialPanel() {
  const [data, setData] = useState<ParseResult | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [tab, setTab] = useState<ComercialTab>("datos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fLinea, setFLinea] = useState("");
  const [fSegmento, setFSegmento] = useState("");
  const [fEstado, setFEstado] = useState("");

  async function handleFile(file: File) {
    setError(null); setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      const result = parseComercialWorkbook(buf, file.name);
      if (!result.rowCount) throw new Error("No se encontraron oportunidades válidas en el archivo.");
      setData(result);
      setRawFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo.");
    } finally {
      setLoading(false);
    }
  }

  const records = data?.records ?? [];

  const opciones = useMemo(() => ({
    lineas:    [...new Set(records.map((r) => r.linea).filter(Boolean))].sort(),
    segmentos: [...new Set(records.map((r) => r.segmento).filter(Boolean))].sort(),
    estados:   [...new Set(records.map((r) => r.ganado).filter(Boolean))].sort(),
  }), [records]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (fLinea && r.linea !== fLinea) return false;
      if (fSegmento && r.segmento !== fSegmento) return false;
      if (fEstado && r.ganado !== fEstado) return false;
      if (q && !(`${r.oportunidad} ${r.cliente} ${r.comercial} ${r.clienteFinal}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [records, search, fLinea, fSegmento, fEstado]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const isState = (r: OportunidadComercial, p: string) => r.ganado.toUpperCase().startsWith(p);
    const ganadas    = filtered.filter((r) => isState(r, "GANAD")).length;
    const perdidas   = filtered.filter((r) => isState(r, "PERDID")).length;
    const pendientes = filtered.filter((r) => isState(r, "PENDIENT")).length;
    const ingreso    = filtered.reduce((s, r) => s + r.ingresoEsperado, 0);
    const ticket     = total ? ingreso / total : 0;
    return { total, ganadas, perdidas, pendientes, ingreso, ticket };
  }, [filtered]);

  const hasFilters = !!(search || fLinea || fSegmento || fEstado);

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 border-b border-white/[0.07] pb-0">
          <button onClick={() => setTab("datos")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab !== "predictor" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            <Table2 size={15} /> Análisis histórico
          </button>
          <button onClick={() => setTab("predictor")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === "predictor" ? "border-blue-500 text-blue-400" : "border-transparent text-slate-500 hover:text-slate-300"}`}>
            <Cpu size={15} /> Predecir oportunidad
          </button>
        </div>
        {tab === "predictor"
          ? <PredictorOportunidad />
          : <UploadZone onFile={handleFile} loading={loading} error={error} />}
      </div>
    );
  }

  const tabs: { id: ComercialTab; label: string; icon: typeof Table2 }[] = [
    { id: "datos",     label: "Datos",               icon: Table2     },
    { id: "spc",       label: "SPC · Carta P (PPB)", icon: Activity   },
    { id: "rf",        label: "Random Forest (PPM)", icon: Cpu        },
    { id: "predictor", label: "Predecir",             icon: TrendingUp },
    { id: "marco",     label: "Marco de medición",   icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      {/* Encabezado de archivo */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 text-sm text-slate-400">
          <FileSpreadsheet size={18} className="text-emerald-400" />
          <span className="font-medium text-slate-200">{data.fileName}</span>
          <span className="text-slate-500">· {data.rowCount.toLocaleString("es-CO")} oportunidades</span>
        </div>
        <button
          onClick={() => { setData(null); setRawFile(null); setTab("datos"); setError(null); setSearch(""); setFLinea(""); setFSegmento(""); setFEstado(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 border border-white/[0.07] hover:bg-white/[0.05] transition-colors"
        >
          <X size={13} /> Cargar otro archivo
        </button>
      </div>

      {/* Tabs internos */}
      <div className="flex items-center gap-1.5 flex-wrap border-b border-white/[0.07]">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = id === tab;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300 hover:border-white/20"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          );
        })}
      </div>

      {tab === "spc"       && rawFile && <SpcRunner file={rawFile} />}
      {tab === "rf"        && rawFile && <RfRunner  file={rawFile} />}
      {tab === "predictor" && <PredictorOportunidad />}
      {tab === "marco"     && <MarcoMedicion area="comercial" />}

      {tab === "datos" && (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={Layers}       label="Oportunidades" value={kpis.total.toLocaleString("es-CO")}     tint="bg-blue-500/10 text-blue-400"    />
        <Kpi icon={Trophy}       label="Ganadas"       value={kpis.ganadas.toLocaleString("es-CO")}   tint="bg-emerald-500/10 text-emerald-400" />
        <Kpi icon={TrendingDown} label="Perdidas"      value={kpis.perdidas.toLocaleString("es-CO")}  tint="bg-rose-500/10 text-rose-400"    />
        <Kpi icon={Clock}        label="Pendientes"    value={kpis.pendientes.toLocaleString("es-CO")}tint="bg-amber-500/10 text-amber-400"  />
        <Kpi icon={DollarSign}   label="Ingreso esp."  value={fmtCompact(kpis.ingreso)}               tint="bg-violet-500/10 text-violet-400" />
        <Kpi icon={DollarSign}   label="Ticket prom."  value={fmtCompact(kpis.ticket)}                tint="bg-cyan-500/10 text-cyan-400"    />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2.5 flex-wrap bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] px-4 py-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar oportunidad, cliente, comercial…"
            className="pl-9 pr-4 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors w-72"
          />
        </div>
        <select value={fLinea} onChange={(e) => setFLinea(e.target.value)} className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors">
          <option value="">Todas las líneas</option>
          {opciones.lineas.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={fSegmento} onChange={(e) => setFSegmento(e.target.value)} className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors">
          <option value="">Todos los segmentos</option>
          {opciones.segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 transition-colors">
          <option value="">Todos los estados</option>
          {opciones.estados.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFLinea(""); setFSegmento(""); setFEstado(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-white/[0.05] transition-colors">
            <X size={13} /> Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">{filtered.length.toLocaleString("es-CO")} resultados</span>
      </div>

      {/* Tabla */}
      <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-black/20 backdrop-blur-md border-b border-white/[0.07]">
                {["Oportunidad", "Cliente", "Comercial", "Línea", "Segmento", "Ingreso esp.", "Estado", "Etapa actual", "Creado"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((r) => (
                <tr key={r.rowId} className="hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-200 max-w-[260px] truncate" title={r.oportunidad}>{r.oportunidad || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-[220px] truncate" title={r.cliente}>{r.cliente || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{r.comercial || "—"}</td>
                  <td className="px-4 py-3">{r.linea ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lineaBadge(r.linea)}`}>{r.linea}</span> : "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{r.segmento || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-300 whitespace-nowrap tabular-nums">{fmtCOP(r.ingresoEsperado)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${estadoBadge(r.ganado)}`}>{r.ganado || "—"}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate" title={r.etapaActual}>{r.etapaActual || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDate(r.creado)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-500">No hay oportunidades que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

/* ── PROYECTOS ─────────────────────────────────────────────────────── */

const PORTAFOLIOS = ["TI", "DATOS Y SISTEMAS DE INFORMACIÓN", "CONSULTORÍA"] as const;

const SEM_COLORS: Record<string, string> = {
  VERDE:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  AMARILLO: "text-amber-400   bg-amber-500/10   border-amber-500/20",
  ROJO:     "text-rose-400    bg-rose-500/10    border-rose-500/20",
};

const SEM_DOT: Record<string, string> = {
  VERDE: "bg-emerald-400", AMARILLO: "bg-amber-400", ROJO: "bg-rose-400",
};

function SemaforoCard({ titulo, data, subtitulo }: {
  titulo: string; data: SemaforoProy; subtitulo?: string;
}) {
  const cls = SEM_COLORS[data.semaforo] ?? SEM_COLORS.AMARILLO;
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{titulo}</p>
        <span className={`w-2.5 h-2.5 rounded-full ${SEM_DOT[data.semaforo]}`} />
      </div>
      <p className="text-3xl font-bold">{data.probabilidad_pct}</p>
      <p className="text-sm font-semibold">{data.nivel ?? data.estado} · AUC {data.auc}</p>
      {subtitulo && <p className="text-xs opacity-70">{subtitulo}</p>}
      {data.vs_historico && <p className="text-xs opacity-70">Vs. histórico: {data.vs_historico}</p>}
      {data.confianza    && <p className="text-xs opacity-60 italic">{data.confianza}</p>}
    </div>
  );
}

function PerfilCard({ perfil }: { perfil: KickoffResponse["perfil_combinado"] }) {
  const cls = SEM_COLORS[perfil.semaforo] ?? SEM_COLORS.AMARILLO;
  return (
    <div className={`rounded-xl border p-4 col-span-2 ${cls}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Perfil combinado</p>
      <div className="flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${SEM_DOT[perfil.semaforo]}`} />
        <p className="text-sm font-medium">{perfil.descripcion}</p>
      </div>
    </div>
  );
}

function LbCard({ lb }: { lb: LineaBaseSpi }) {
  const cls = SEM_COLORS[lb.semaforo] ?? SEM_COLORS.AMARILLO;
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-2">
        Línea Base SPI · fase {lb.fase}
      </p>
      <p className="text-2xl font-bold mb-1">{lb.SPI_observado.toFixed(4)}</p>
      <p className="text-sm font-semibold mb-2">{lb.estado}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {[["LCL", lb.LCL], ["CL", lb.CL], ["UCL", lb.UCL]].map(([k, v]) => (
          <div key={k as string} className="text-center">
            <p className="font-bold">{v != null ? (v as number).toFixed(4) : "—"}</p>
            <p className="opacity-60">{k as string}</p>
          </div>
        ))}
      </div>
      {lb.sigmas_desde_CL != null && (
        <p className="text-xs opacity-70 mt-2">
          {lb.sigmas_desde_CL > 0 ? "+" : ""}{lb.sigmas_desde_CL} σ desde CL · n={lb.n} · {lb.fuente}
        </p>
      )}
    </div>
  );
}

function AvisosBanner({ avisos }: { avisos: string[] }) {
  if (!avisos.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {avisos.map((a, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {a}
        </div>
      ))}
    </div>
  );
}

/* ── PKL Info Panel ────────────────────────────────────────────────── */
const AUC_COLOR = (auc: number) =>
  auc >= 0.80 ? "text-emerald-400" : auc >= 0.65 ? "text-yellow-400" : "text-rose-400";

function PklCard({ title, bloque }: { title: string; bloque: PklBloque }) {
  if (!bloque.disponible) return (
    <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4">
      <p className="text-sm font-semibold text-slate-400">{title}</p>
      <p className="text-xs text-rose-400 mt-1">No disponible</p>
    </div>
  );
  const m = bloque.metricas!;
  const total = (m.tp + m.fp + m.fn + m.tn) || 1;
  return (
    <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{bloque.algoritmo} · v{bloque.version}</p>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${AUC_COLOR(m.auc)}`}>{m.auc.toFixed(3)}<span className="text-xs font-normal ml-1 text-slate-500">AUC</span></span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">{bloque.descripcion}</p>
      {/* Métricas en grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Precisión", val: `${(m.precision * 100).toFixed(1)}%` },
          { label: "Recall",    val: `${(m.recall    * 100).toFixed(1)}%` },
          { label: "F1",        val: `${(m.f1        * 100).toFixed(1)}%` },
          { label: "Brier",     val: m.brier.toFixed(4) },
          { label: "FPR",       val: `${(m.fpr * 100).toFixed(1)}%` },
          { label: "n obs",     val: m.n_obs.toLocaleString("es-CO") },
        ].map(({ label, val }) => (
          <div key={label} className="bg-black/20 rounded-lg py-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className="text-xs font-semibold text-slate-300 tabular-nums">{val}</p>
          </div>
        ))}
      </div>
      {/* Matriz de confusión */}
      <div>
        <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Matriz de confusión (umbral {m.umbral_alerta})</p>
        <div className="grid grid-cols-2 gap-1 text-center text-xs">
          <div className="bg-emerald-900/30 border border-emerald-700/30 rounded py-1">
            <p className="text-[10px] text-slate-500">VP</p>
            <p className="font-bold text-emerald-400">{m.tp} <span className="font-normal text-slate-500">({(m.tp/total*100).toFixed(1)}%)</span></p>
          </div>
          <div className="bg-rose-900/20 border border-rose-700/20 rounded py-1">
            <p className="text-[10px] text-slate-500">FP</p>
            <p className="font-bold text-rose-400">{m.fp} <span className="font-normal text-slate-500">({(m.fp/total*100).toFixed(1)}%)</span></p>
          </div>
          <div className="bg-rose-900/20 border border-rose-700/20 rounded py-1">
            <p className="text-[10px] text-slate-500">FN</p>
            <p className="font-bold text-rose-400">{m.fn} <span className="font-normal text-slate-500">({(m.fn/total*100).toFixed(1)}%)</span></p>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-700/30 rounded py-1">
            <p className="text-[10px] text-slate-500">VN</p>
            <p className="font-bold text-emerald-400">{m.tn} <span className="font-normal text-slate-500">({(m.tn/total*100).toFixed(1)}%)</span></p>
          </div>
        </div>
      </div>
      {/* Features */}
      {bloque.features && bloque.features.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Variables del modelo</p>
          <div className="flex flex-wrap gap-1">
            {bloque.features.map((f) => (
              <span key={f} className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] text-indigo-300 font-mono">{f}</span>
            ))}
          </div>
        </div>
      )}
      {/* Importancia */}
      {bloque.importancia && bloque.importancia.length > 0 && (
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1.5">Importancia de variables</p>
          <div className="space-y-1">
            {bloque.importancia.map(({ variable, importancia, pct }) => (
              <div key={variable} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-32 truncate font-mono">{variable}</span>
                <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: pct }} />
                </div>
                <span className="text-[10px] text-slate-500 w-8 text-right tabular-nums">{pct}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Portafolios + líderes */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{bloque.lideres_n} líderes en historial</span>
        <span>·</span>
        <span>{((bloque.pkl_bytes ?? 0) / 1024).toFixed(1)} KB</span>
      </div>
    </div>
  );
}

function PklInfoPanel({ info }: { info: ProyectosInfoResponse }) {
  return (
    <div className="space-y-4">
      {/* Resumen global */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          { label: "Kickoff AUC",  val: info.kickoff.metricas?.auc.toFixed(3),   color: AUC_COLOR(info.kickoff.metricas?.auc ?? 0)  },
          { label: "Modelo A AUC", val: info.modelo_a.metricas?.auc.toFixed(3),  color: AUC_COLOR(info.modelo_a.metricas?.auc ?? 0) },
          { label: "Modelo 1 AUC", val: info.modelo1.metricas?.auc.toFixed(3),   color: AUC_COLOR(info.modelo1.metricas?.auc ?? 0)  },
          { label: "Modelo 2 AUC", val: info.modelo2.metricas?.auc.toFixed(3),   color: AUC_COLOR(info.modelo2.metricas?.auc ?? 0)  },
          { label: "Datos hasta",  val: info.fecha_datos_hasta ?? "—",            color: "text-sky-400"                               },
          { label: "Proyectos",    val: info.n_proyectos ? String(info.n_proyectos) : "—", color: "text-slate-300"                  },
        ] as {label:string;val?:string;color:string}[]).map(({ label, val, color }) => (
          <div key={label} className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold tabular-nums ${color}`}>{val ?? "—"}</p>
          </div>
        ))}
      </div>
      {/* Línea base SPI */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] px-4 py-3 flex items-center gap-4 text-xs text-slate-400">
        <span className={info.linea_base_spi.disponible ? "text-emerald-400" : "text-rose-400"}>
          {info.linea_base_spi.disponible ? "✅" : "❌"} Línea base SPI
        </span>
        <span>{info.linea_base_spi.n_portafolios} portafolios: {info.linea_base_spi.portafolios.join(" · ")}</span>
        <span className="ml-auto">{info.xlsx_disponible ? `Excel ${(info.xlsx_bytes/1024).toFixed(0)} KB` : "Sin Excel base"}</span>
      </div>
      {/* Cards de cada modelo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PklCard title="Modelo Kickoff — Riesgo de cronograma"   bloque={info.kickoff}  />
        <PklCard title="Modelo A — Riesgo de alcance"            bloque={info.modelo_a} />
        <PklCard title="Modelo 1 — Alerta mensual SPI"           bloque={info.modelo1}  />
        <PklCard title="Modelo 2 — Riesgo estructural (early)"   bloque={info.modelo2}  />
      </div>

      {/* Datos origen */}
      {info.datos_origen && <DatosOrigenPanel datos={info.datos_origen} />}
    </div>
  );
}

function DatosOrigenPanel({ datos }: { datos: DatosOrigen }) {
  const portafolios = Object.entries(datos.por_portafolio);
  const spiColor = (v: number) =>
    v >= 0.95 ? "text-emerald-400" : v >= 0.80 ? "text-yellow-400" : "text-rose-400";
  const estadoColor = (e: string) =>
    e === "Completado" ? "text-emerald-400" : "text-sky-400";

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <span className="text-base">📂</span> Datos de entrenamiento
        <span className="text-xs font-normal text-slate-500 ml-1">
          {datos.fecha_min} – {datos.fecha_max} · {datos.n_observaciones} observaciones · {datos.proyectos.length} proyectos
        </span>
      </h3>

      {/* Resumen por portafolio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {portafolios.map(([port, p]) => (
          <div key={port} className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-300 leading-tight">{port}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <span className="text-slate-500">Proyectos</span>
              <span className="text-slate-200 font-medium">{p.n_proyectos}</span>
              <span className="text-slate-500">Duración media</span>
              <span className="text-slate-200 font-medium">{p.duracion_media} meses</span>
              <span className="text-slate-500">SPI mín mediana</span>
              <span className={`font-medium ${spiColor(p.spi_min_mediana)}`}>{p.spi_min_mediana}</span>
              <span className="text-slate-500">Completados</span>
              <span className="text-emerald-400 font-medium">{p.pct_completados}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de proyectos */}
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["ID", "Líder", "Portafolio", "Meses", "Reportes", "SPI mín", "SPI final", "Completado", "Estado"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.proyectos.map((p: DatosOrigenProyecto, i: number) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                <td className="px-3 py-1.5 font-mono text-slate-400">{p.id}</td>
                <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">{p.lider.split(" ").slice(0,2).join(" ")}</td>
                <td className="px-3 py-1.5 text-slate-400">{p.portafolio.split(" ")[0]}</td>
                <td className="px-3 py-1.5 text-slate-300 text-right tabular-nums">{p.meses}</td>
                <td className="px-3 py-1.5 text-slate-400 text-right tabular-nums">{p.n_reportes}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${spiColor(p.spi_min)}`}>{p.spi_min}</td>
                <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${spiColor(p.spi_final)}`}>{p.spi_final}</td>
                <td className="px-3 py-1.5 text-slate-300 text-right tabular-nums">{p.completado_final}</td>
                <td className={`px-3 py-1.5 font-medium ${estadoColor(p.estado)}`}>{p.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type ProyTab = "kickoff" | "seguimiento" | "reentrenar" | "modelos" | "marco";

function ProyectosPanel() {
  const [tab, setTab]   = useState<ProyTab>("kickoff");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);

  // Kickoff state
  const [kPort,  setKPort]  = useState<string>(PORTAFOLIOS[0]);
  const [kLider, setKLider] = useState("");
  const [kDur,   setKDur]   = useState("");
  const [kPres,  setKPres]  = useState("");
  const [kRes,   setKRes]   = useState<KickoffResponse | null>(null);

  // Seguimiento state
  const [sPort,  setSPort]  = useState<string>(PORTAFOLIOS[0]);
  const [sLider, setSLider] = useState("");
  const [sMes,   setSMes]   = useState("");
  const [sSpi1,  setSSpi1]  = useState("");
  const [sVra1,  setSVra1]  = useState("");
  const [sSpi2,  setSSpi2]  = useState("");
  const [sSpiObs,setSSpiObs]= useState("");
  const [sRes,   setSRes]   = useState<SeguimientoResponse | null>(null);

  function reset() {
    setError(null); setNotice(null);
  }

  async function runKickoff() {
    reset(); setLoading(true); setKRes(null);
    try {
      const r = await fetch("/api/cmmi/proyectos/kickoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portafolio:     kPort,
          lider:          kLider.trim() || "Desconocido",
          duracion_meses: parseFloat(kDur) || 0,
          presupuesto:    kPres ? parseFloat(kPres) : null,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setKRes(json as KickoffResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al ejecutar el modelo.");
    } finally { setLoading(false); }
  }

  async function runSeguimiento() {
    reset(); setLoading(true); setSRes(null);
    try {
      const r = await fetch("/api/cmmi/proyectos/seguimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portafolio:    sPort,
          lider:         sLider.trim() || "Desconocido",
          mes_rel:       parseFloat(sMes) || 0,
          spi_lag1:      parseFloat(sSpi1) || 0,
          vra_lag1:      parseFloat(sVra1) || 0,
          spi_lag2:      sSpi2   ? parseFloat(sSpi2)   : null,
          spi_observado: sSpiObs ? parseFloat(sSpiObs) : null,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setSRes(json as SeguimientoResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al ejecutar el modelo.");
    } finally { setLoading(false); }
  }

  const [info, setInfo] = useState<ProyectosInfoResponse | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  async function loadInfo() {
    if (info) return;
    setInfoLoading(true);
    try {
      const r = await fetch("/api/cmmi/proyectos/info");
      const j = await r.json();
      if (r.ok) setInfo(j as ProyectosInfoResponse);
    } finally { setInfoLoading(false); }
  }

  const tabs: { id: ProyTab; label: string; icon: typeof Activity }[] = [
    { id: "kickoff",     label: "Kickoff",            icon: BarChart2   },
    { id: "seguimiento", label: "Seguimiento",         icon: CalendarCheck },
    { id: "reentrenar",  label: "Reentrenar",          icon: Database    },
    { id: "modelos",     label: "Modelos PKL",         icon: PieChart    },
    { id: "marco",       label: "Marco de medición",   icon: ShieldCheck },
  ];

  const inputCls = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors";
  const labelCls = "text-xs font-medium text-slate-400 mb-1";

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.07]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id as ProyTab); reset(); if (id === "modelos") loadInfo(); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-300 hover:border-white/20"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── KICKOFF ─────────────────────────────────────────────────── */}
      {tab === "kickoff" && (
        <div className="space-y-5">
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <BarChart2 size={16} className="text-indigo-400" />
              Evaluación en el kickoff del proyecto
            </p>
            <p className="text-xs text-slate-500">
              Modelo Kickoff (SPI) · Modelo A (alcance) — solo requiere variables disponibles antes de iniciar la ejecución.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className={labelCls}>Portafolio</p>
                <select value={kPort} onChange={(e) => setKPort(e.target.value)} className={inputCls}>
                  {PORTAFOLIOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <p className={labelCls}>Líder del proyecto</p>
                <input value={kLider} onChange={(e) => setKLider(e.target.value)} placeholder="Nombre completo" className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>Duración planificada (meses)</p>
                <input type="number" min={1} value={kDur} onChange={(e) => setKDur(e.target.value)} placeholder="ej. 8" className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>Presupuesto COP <span className="text-slate-600">(opcional)</span></p>
                <input type="number" min={0} value={kPres} onChange={(e) => setKPres(e.target.value)} placeholder="ej. 950000000" className={inputCls} />
              </div>
            </div>
            <button
              onClick={runKickoff}
              disabled={loading || !kDur}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Clock size={15} className="animate-spin" /> : <Play size={15} />}
              {loading ? "Ejecutando…" : "Evaluar en kickoff"}
            </button>
          </div>

          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {kRes && (
            <div className="space-y-4">
              <AvisosBanner avisos={kRes.avisos} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SemaforoCard titulo="Modelo Kickoff — Riesgo SPI" data={kRes.kickoff} />
                <SemaforoCard titulo="Modelo A — Riesgo de alcance" data={kRes.modelo_a} />
                <PerfilCard perfil={kRes.perfil_combinado} />
              </div>
              <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] px-4 py-3 text-xs text-slate-500 space-y-1">
                <p><span className="text-slate-400 font-medium">Siguiente paso:</span> al llegar el primer reporte mensual, pasar a la pestaña <span className="text-blue-400">Seguimiento</span> con el Modelo 2 (AUC 0.85).</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SEGUIMIENTO ─────────────────────────────────────────────── */}
      {tab === "seguimiento" && (
        <div className="space-y-5">
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CalendarCheck size={16} className="text-indigo-400" />
              Seguimiento mensual del proyecto
            </p>
            <p className="text-xs text-slate-500">
              Modelo 1 (alerta SPI este mes) · Modelo 2 (riesgo estructural) · Línea base SPI por fase.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className={labelCls}>Portafolio</p>
                <select value={sPort} onChange={(e) => setSPort(e.target.value)} className={inputCls}>
                  {PORTAFOLIOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <p className={labelCls}>Líder del proyecto</p>
                <input value={sLider} onChange={(e) => setSLider(e.target.value)} placeholder="Nombre completo" className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>Mes relativo [0.0 – 1.0]</p>
                <input type="number" step={0.01} min={0} max={1} value={sMes} onChange={(e) => setSMes(e.target.value)} placeholder="ej. 0.35 = 35% del ciclo de vida" className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>SPI mes anterior</p>
                <input type="number" step={0.001} value={sSpi1} onChange={(e) => setSSpi1(e.target.value)} placeholder="ej. 0.92" className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>VRA mes anterior</p>
                <input type="number" step={0.001} value={sVra1} onChange={(e) => setSVra1(e.target.value)} placeholder="ej. -0.08" className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>SPI hace 2 meses <span className="text-slate-600">(opcional)</span></p>
                <input type="number" step={0.001} value={sSpi2} onChange={(e) => setSSpi2(e.target.value)} placeholder="ej. 0.97" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <p className={labelCls}>SPI observado este mes <span className="text-slate-600">(opcional — para línea base)</span></p>
                <input type="number" step={0.001} value={sSpiObs} onChange={(e) => setSSpiObs(e.target.value)} placeholder="ej. 0.87" className={inputCls} />
              </div>
            </div>
            <button
              onClick={runSeguimiento}
              disabled={loading || !sMes || !sSpi1 || !sVra1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Clock size={15} className="animate-spin" /> : <Play size={15} />}
              {loading ? "Ejecutando…" : "Evaluar seguimiento"}
            </button>
          </div>

          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {sRes && (
            <div className="space-y-4">
              <AvisosBanner avisos={sRes.avisos} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SemaforoCard titulo="Modelo 1 — Alerta mensual SPI" data={sRes.modelo1} />
                <SemaforoCard titulo="Modelo 2 — Riesgo estructural" data={sRes.modelo2} />
                {sRes.linea_base_spi && <LbCard lb={sRes.linea_base_spi} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODELOS PKL ─────────────────────────────────────────────── */}
      {tab === "modelos" && (
        <div className="space-y-4">
          {infoLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-6 justify-center">
              <Clock size={15} className="animate-spin" /> Cargando info de modelos…
            </div>
          )}
          {!infoLoading && !info && (
            <p className="text-sm text-slate-500 text-center py-6">No se pudo cargar la información. ¿Está corriendo el microservicio?</p>
          )}
          {info && <PklInfoPanel info={info} />}
        </div>
      )}

      {/* ── REENTRENAR ──────────────────────────────────────────────── */}
      {tab === "reentrenar" && (
        <div className="space-y-4">
          <div className="bg-white/[0.04] rounded-xl border border-white/[0.08] px-4 py-3 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">¿Cuándo reentrenar?</p>
            <ul className="list-disc list-inside space-y-0.5 text-slate-500">
              <li>Tienes 20+ proyectos nuevos cerrados con SPI mensual registrado</li>
              <li>Hay nuevos líderes de proyecto que el modelo no conoce</li>
              <li>Se incorporó un nuevo portafolio</li>
              <li>El modelo muestra predicciones inconsistentes con la realidad</li>
            </ul>
            <p className="pt-1 text-slate-500">
              El Excel debe tener las columnas: <span className="text-slate-400 font-mono">ProjectId, Portafolio, ProjectOwnerName, Meses, Presupuesto, Mes Relativo, SPI (Schedule Performance Index), Variación Relativa Avance, Completado Real</span>
            </p>
          </div>
          <UploadExcelRefresh
            endpoint="/api/cmmi/proyectos/reentrenar"
            label="Subir Excel histórico de proyectos para reentrenar los 4 modelos"
            successMsg={(r) => {
              const m = r.metricas as Record<string, number> | undefined;
              return `✅ Reentrenamiento completado — ${r.n_proyectos} proyectos · ${r.n_obs} obs · Kickoff AUC ${m?.kickoff_auc?.toFixed(3)} · M1 AUC ${m?.modelo1_auc?.toFixed(3)}`;
            }}
            onSuccess={() => { setKRes(null); setSRes(null); }}
          />
        </div>
      )}

      {tab === "marco" && <MarcoMedicion area="proyectos" />}
    </div>
  );
}

/* ── Upload Excel reutilizable ─────────────────────────────────────── */
function UploadExcelRefresh({
  endpoint, label, onSuccess, successMsg,
}: {
  endpoint: string;
  label: string;
  onSuccess: (res: Record<string, unknown>) => void;
  successMsg?: (res: Record<string, unknown>) => string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg]             = useState<{ ok: boolean; text: string } | null>(null);

  async function handleFile(file: File) {
    setUploading(true); setMsg(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r    = await fetch(endpoint, { method: "POST", body: form });
      const json = await r.json();
      if (!r.ok) throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      const text = successMsg
        ? successMsg(json as Record<string, unknown>)
        : `Datos actualizados · n=${json.n_obs ?? json.n_proyectos ?? "?"}`;
      setMsg({ ok: true, text });
      onSuccess(json);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Error al cargar." });
    } finally { setUploading(false); }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.02] hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors cursor-pointer"
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <Upload size={16} className="text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500">
          {uploading ? "Cargando…" : "Arrastra o haz clic para subir nuevo .xlsx"}
        </span>
        {uploading && <Clock size={14} className="animate-spin text-indigo-400 ml-auto" />}
      </div>
      <input ref={ref} type="file" accept=".xlsx,.xls" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      {msg && (
        <p className={`text-xs ${msg.ok ? "text-emerald-400" : "text-rose-400"}`}>
          {msg.ok ? "✓" : "✗"} {msg.text}
        </p>
      )}
    </div>
  );
}

/* ── FINANCIERO ────────────────────────────────────────────────────── */

const CATEGORIAS_FIN = [
  "Arquitectura Empresarial",
  "Analítica / IA",
  "Ciberseguridad",
  "Desarrollo",
  "Gobierno de Datos",
  "Infra + Servicios gestionados",
  "Infra + Servicios + Ciber",
  "Infraestructura",
  "Migración",
  "Procesos",
  "Servicios gestionados",
  "Sostenibilidad",
  "Transformación Digital",
] as const;

type FinTab = "predictor" | "lineas-base" | "datos" | "marco";

const RIESGO_COLORS: Record<string, string> = {
  Bajo:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  Medio: "text-amber-400   bg-amber-500/10   border-amber-500/20",
  Alto:  "text-rose-400    bg-rose-500/10    border-rose-500/20",
};
const RIESGO_DOT: Record<string, string> = {
  Bajo: "bg-emerald-400", Medio: "bg-amber-400", Alto: "bg-rose-400",
};

function NelsonBadges({ nelson }: { nelson: Record<string, number> }) {
  const active = Object.entries(nelson).filter(([, n]) => n > 0);
  if (!active.length)
    return <span className="text-xs text-emerald-400 font-medium">Sin violaciones</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map(([r, n]) => (
        <span key={r} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400">
          {r} ({n})
        </span>
      ))}
    </div>
  );
}

function LbCard2({ cat, data }: { cat: string; data: LineaBaseBloque }) {
  const cls = RIESGO_COLORS[data.riesgo] ?? RIESGO_COLORS.Medio;
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${cls}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70 truncate">{cat}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${RIESGO_DOT[data.riesgo]}`} />
          <span className="text-xs font-semibold">{data.riesgo}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-center">
        {[["LCL", data.lcl], ["CL", data.mean], ["UCL", data.ucl]].map(([k, v]) => (
          <div key={k as string}>
            <p className="font-bold">{((v as number) * 100).toFixed(1)}%</p>
            <p className="opacity-60">{k as string}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="opacity-60">n={data.n} · σ={((data.std) * 100).toFixed(1)}% · CV={data.cv.toFixed(0)}%</span>
        <span className={data.bajo_control ? "text-emerald-400" : "text-amber-400"}>
          {data.bajo_control ? "✓ control" : "⚠ revisar"}
        </span>
      </div>
      <NelsonBadges nelson={data.nelson} />
    </div>
  );
}

function FinancieroPanel() {
  const [tab, setTab]     = useState<FinTab>("predictor");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);

  // Predictor
  const [pCat,   setPCat]   = useState<string>(CATEGORIAS_FIN[0]);
  const [pMonto, setPMonto] = useState("");
  const [pRes,   setPRes]   = useState<PrediccionFinResponse | null>(null);

  // Líneas base
  const [lbRes,  setLbRes]  = useState<LineasBaseResponse | null>(null);
  const [lbLoaded, setLbLoaded] = useState(false);

  // Datos origen
  const [finInfo, setFinInfo] = useState<FinancieroInfoResponse | null>(null);
  const [finInfoLoaded, setFinInfoLoaded] = useState(false);

  function reset() { setError(null); setNotice(null); }

  async function runPrediccion() {
    reset(); setLoading(true); setPRes(null);
    try {
      const r = await fetch("/api/cmmi/financiero/predecir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria: pCat, monto_cop: parseFloat(pMonto) || 0 }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setPRes(json as PrediccionFinResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al ejecutar el modelo.");
    } finally { setLoading(false); }
  }

  async function loadLineasBase() {
    reset(); setLoading(true); setLbRes(null);
    try {
      const r = await fetch("/api/cmmi/financiero/lineas-base");
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setLbRes(json as LineasBaseResponse);
      setLbLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar líneas base.");
    } finally { setLoading(false); }
  }

  async function loadFinInfo() {
    if (finInfoLoaded) return;
    reset(); setLoading(true);
    try {
      const r = await fetch("/api/cmmi/financiero/info");
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setFinInfo(json as FinancieroInfoResponse);
      setFinInfoLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos de entrenamiento.");
    } finally { setLoading(false); }
  }

  const tabs: { id: FinTab; label: string; icon: typeof Activity }[] = [
    { id: "predictor",   label: "Predictor",           icon: TrendingUp  },
    { id: "lineas-base", label: "Líneas base",         icon: PieChart    },
    { id: "datos",       label: "Datos entrenamiento", icon: Database    },
    { id: "marco",       label: "Marco de medición",   icon: ShieldCheck },
  ];

  const inputCls = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors";
  const labelCls = "text-xs font-medium text-slate-400 mb-1";

  const semColors: Record<string, string> = {
    VERDE:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    AMARILLO: "text-amber-400   bg-amber-500/10   border-amber-500/20",
    ROJO:     "text-rose-400    bg-rose-500/10    border-rose-500/20",
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.07]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setTab(id); reset(); if (id === "datos") loadFinInfo(); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-300 hover:border-white/20"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── PREDICTOR ──────────────────────────────────────────── */}
      {tab === "predictor" && (
        <div className="space-y-5">
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-400" />
              Predicción de utilidad por categoría y monto
            </p>
            <p className="text-xs text-slate-500">
              Regresión OLS múltiple (Modelo B, sin outliers |z|{">"}2.5) · R²adj≈16% · usar como referencia indicativa.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className={labelCls}>Categoría del proyecto</p>
                <select value={pCat} onChange={(e) => setPCat(e.target.value)} className={inputCls}>
                  {CATEGORIAS_FIN.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <p className={labelCls}>Monto del contrato COP</p>
                <input
                  type="number" min={0} value={pMonto}
                  onChange={(e) => setPMonto(e.target.value)}
                  placeholder="ej. 3500000000"
                  className={inputCls}
                />
              </div>
            </div>
            <button
              onClick={runPrediccion}
              disabled={loading || !pMonto}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Clock size={15} className="animate-spin" /> : <Play size={15} />}
              {loading ? "Calculando…" : "Predecir utilidad"}
            </button>
            <div className="pt-2 border-t border-white/[0.06]">
              <UploadExcelRefresh
                endpoint="/api/cmmi/financiero/cargar"
                label="Actualizar datos históricos de utilidad"
                onSuccess={() => { setPRes(null); setLbRes(null); setLbLoaded(false); }}
              />
            </div>
          </div>

          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {pRes && (
            <div className="space-y-4">
              {pRes.advertencia && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {pRes.advertencia}
                </div>
              )}
              <div className={`rounded-xl border p-5 space-y-4 ${semColors[pRes.semaforo]}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Utilidad estimada — {pRes.categoria}</p>
                  <span className="text-xs font-bold">{pRes.semaforo}</span>
                </div>
                <p className="text-4xl font-bold">{pRes.utilidad_pct}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-xs opacity-60 mb-1">Intervalo ±2σ</p>
                    <p className="font-semibold">{pRes.intervalo_min_pct} · {pRes.intervalo_max_pct}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-xs opacity-60 mb-1">Monto</p>
                    <p className="font-semibold">{pRes.monto_miles_mm.toFixed(2)} MM$</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs opacity-70">
                  <p>R²adj {((pRes.modelo.r2a) * 100).toFixed(1)}%</p>
                  <p>RMSE {(pRes.rmse * 100).toFixed(1)}pp</p>
                  <p>n={pRes.modelo.n}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 italic">
                F p={pRes.modelo.pF.toFixed(4)} — modelo marginalmente significativo. Usar como orientación, no como compromiso.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── LÍNEAS BASE ────────────────────────────────────────── */}
      {tab === "lineas-base" && (
        <div className="space-y-5">
          {!lbLoaded && (
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-5 space-y-5">
              {/* Opción 1: datos existentes */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-300">Desde datos históricos</p>
                <p className="text-xs text-slate-500">
                  Calcula líneas base (SPC) y reglas de Nelson sobre los proyectos terminados ya cargados en el servidor.
                </p>
                <button
                  onClick={loadLineasBase}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? <Clock size={15} className="animate-spin" /> : <PieChart size={15} />}
                  {loading ? "Cargando…" : "Cargar líneas base"}
                </button>
              </div>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-white/[0.07]" />
                <span className="text-xs text-slate-600">o</span>
                <div className="flex-1 border-t border-white/[0.07]" />
              </div>
              {/* Opción 2: nuevo Excel */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-300">Desde un nuevo archivo Excel</p>
                <p className="text-xs text-slate-500">
                  Sube un .xlsx con proyectos terminados para calcular CL, σ, UCL, LCL y reglas de Nelson en tiempo real.
                </p>
                <UploadExcelRefresh
                  endpoint="/api/cmmi/financiero/lineas-base-excel"
                  label="Arrastra o selecciona el Excel de utilidad"
                  onSuccess={(res) => { setLbRes(res as unknown as LineasBaseResponse); setLbLoaded(true); }}
                />
              </div>
            </div>
          )}

          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {lbRes && (
            <div className="space-y-6">
              {/* Global */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Global · n={lbRes.global.n}</p>
                <LbCard2 cat="GLOBAL" data={lbRes.global} />
              </div>
              {/* Por categoría */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
                  Por categoría ({lbRes.categorias_disponibles.length} con n≥3)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {lbRes.categorias_disponibles.map((cat) => (
                    <LbCard2 key={cat} cat={cat} data={lbRes.por_categoria[cat]} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DATOS ENTRENAMIENTO ──────────────────────────────────── */}
      {tab === "datos" && (
        <div className="space-y-5">
          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {loading && <p className="text-xs text-slate-500 animate-pulse">Cargando datos…</p>}
          {finInfo && finInfo.disponible && <FinancieroOrigenPanel info={finInfo} />}
          {finInfo && !finInfo.disponible && (
            <p className="text-sm text-slate-500">Excel de entrenamiento no disponible en el servidor.</p>
          )}
        </div>
      )}

      {tab === "marco" && <MarcoMedicion area="financiero" />}
    </div>
  );
}

/* ── DATOS (Gobierno de Datos) ─────────────────────────────────────── */

const CATEGORIAS_DATOS = [
  "Calidad de Datos",
  "Gestion Ciclo-Vida Datos",
  "Integracion-Flujo Datos",
  "Uso-Acceso Datos",
] as const;

type DatosTab = "predictor" | "lineas-base" | "historico" | "marco";

function DatosPanel() {
  const [tab, setTab]       = useState<DatosTab>("predictor");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);

  // Predictor
  const [pCat,    setPCat]    = useState<string>(CATEGORIAS_DATOS[0]);
  const [pPeriodo,setPPeriodo]= useState("");
  const [pRes,    setPRes]    = useState<PrediccionDatosResponse | null>(null);

  // Líneas base
  const [lbRes,   setLbRes]   = useState<LineasBaseDatosResponse | null>(null);
  const [lbLoaded,setLbLoaded]= useState(false);

  // Histórico
  const [datosInfo, setDatosInfo] = useState<DatosInfoResponse | null>(null);
  const [datosInfoLoaded, setDatosInfoLoaded] = useState(false);

  function reset() { setError(null); setNotice(null); }

  async function runPrediccion() {
    reset(); setLoading(true); setPRes(null);
    try {
      const r = await fetch("/api/cmmi/datos/predecir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria: pCat, periodo: parseInt(pPeriodo) || 1 }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setPRes(json as PrediccionDatosResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al ejecutar el modelo.");
    } finally { setLoading(false); }
  }

  async function loadLineasBase() {
    reset(); setLoading(true); setLbRes(null);
    try {
      const r = await fetch("/api/cmmi/datos/lineas-base");
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setLbRes(json as LineasBaseDatosResponse);
      setLbLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar líneas base.");
    } finally { setLoading(false); }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors";
  const labelCls = "text-xs font-medium text-slate-400 mb-1";

  const semColors: Record<string, string> = {
    VERDE:    "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    AMARILLO: "text-amber-400   bg-amber-500/10   border-amber-500/20",
    ROJO:     "text-rose-400    bg-rose-500/10    border-rose-500/20",
  };

  async function loadDatosInfo() {
    if (datosInfoLoaded) return;
    reset(); setLoading(true);
    try {
      const r = await fetch("/api/cmmi/datos/info");
      const json = await r.json();
      if (!r.ok) {
        if (json.localOnly) { setNotice(json.error); return; }
        throw new Error(json.detail ?? json.error ?? `Error ${r.status}`);
      }
      setDatosInfo(json as DatosInfoResponse);
      setDatosInfoLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos históricos.");
    } finally { setLoading(false); }
  }

  const tabs: { id: DatosTab; label: string; icon: typeof Activity }[] = [
    { id: "predictor",   label: "Predictor",         icon: LineChart   },
    { id: "lineas-base", label: "Líneas base",       icon: Database    },
    { id: "historico",   label: "Data histórica",    icon: Table2      },
    { id: "marco",       label: "Marco de medición", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/[0.07]">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); reset(); if (id === "historico") loadDatosInfo(); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id ? "border-blue-500 text-blue-400"
                        : "border-transparent text-slate-500 hover:text-slate-300 hover:border-white/20"
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── PREDICTOR ─────────────────────────────────────────────── */}
      {tab === "predictor" && (
        <div className="space-y-5">
          <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <LineChart size={16} className="text-indigo-400" />
              Proyección de cubrimiento — Gobierno de Datos
            </p>
            <p className="text-xs text-slate-500">
              Modelo cuadrático Ĉ = β₀ + β<sub>cat</sub> + β₁·P + β₂·P² · IC 95% · períodos históricos y futuros.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className={labelCls}>Categoría</p>
                <select value={pCat} onChange={(e) => setPCat(e.target.value)} className={inputCls}>
                  {CATEGORIAS_DATOS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <p className={labelCls}>Período (número entero)</p>
                <input type="number" min={1} value={pPeriodo}
                  onChange={(e) => setPPeriodo(e.target.value)}
                  placeholder="ej. 11 (siguiente al histórico)"
                  className={inputCls} />
              </div>
            </div>
            <button onClick={runPrediccion} disabled={loading || !pPeriodo}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {loading ? <Clock size={15} className="animate-spin" /> : <Play size={15} />}
              {loading ? "Calculando…" : "Proyectar cubrimiento"}
            </button>
            <div className="pt-2 border-t border-white/[0.06]">
              <UploadExcelRefresh
                endpoint="/api/cmmi/datos/cargar"
                label="Actualizar datos de Gobierno de Datos"
                onSuccess={() => { setPRes(null); setLbRes(null); setLbLoaded(false); }}
              />
            </div>
          </div>

          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {pRes && (
            <div className="space-y-3">
              {pRes.es_proyeccion && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  Período {pRes.periodo} está fuera del rango histórico (máx. P{pRes.periodo_max_historico}) — es una proyección.
                </div>
              )}
              <div className={`rounded-xl border p-5 space-y-4 ${semColors[pRes.semaforo]}`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
                    {pRes.categoria} · P{pRes.periodo}
                  </p>
                  <span className="text-xs font-bold">{pRes.semaforo}</span>
                </div>
                <p className="text-4xl font-bold">{pRes.prediccion_pct}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-xs opacity-60 mb-1">IC {(pRes.nivel_confianza * 100).toFixed(0)}%</p>
                    <p className="font-semibold">{pRes.ic_lo_pct} – {pRes.ic_hi_pct}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3">
                    <p className="text-xs opacity-60 mb-1">Métricas del modelo</p>
                    <p className="font-semibold text-xs">R²={pRes.modelo.r2} · RMSE={(pRes.modelo.rmse * 100).toFixed(2)}pp</p>
                  </div>
                </div>
                <p className="text-xs opacity-60">MAE={( pRes.modelo.mae * 100).toFixed(2)}pp · RMSE-LOO={( pRes.modelo.rmse_loo * 100).toFixed(2)}pp · n={pRes.modelo.n}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LÍNEAS BASE ───────────────────────────────────────────── */}
      {tab === "lineas-base" && (
        <div className="space-y-5">
          {!lbLoaded && (
            <div className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-5 space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-300">Desde datos históricos</p>
                <p className="text-xs text-slate-500">CL, UCL y LCL dinámicos por categoría y período (σ global por categoría).</p>
                <button onClick={loadLineasBase} disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                  {loading ? <Clock size={15} className="animate-spin" /> : <Database size={15} />}
                  {loading ? "Cargando…" : "Cargar líneas base"}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-white/[0.07]" />
                <span className="text-xs text-slate-600">o</span>
                <div className="flex-1 border-t border-white/[0.07]" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-300">Desde un nuevo archivo Excel</p>
                <p className="text-xs text-slate-500">Sube el .xlsx de Gobierno de Datos para calcular CL, UCL, LCL globales y por categoría.</p>
                <UploadExcelRefresh
                  endpoint="/api/cmmi/datos/lineas-base-excel"
                  label="Arrastra o selecciona el Excel de Gobierno de Datos"
                  onSuccess={(res) => { setLbRes(res as unknown as LineasBaseDatosResponse); setLbLoaded(true); }}
                />
              </div>
            </div>
          )}

          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {lbRes && (
            <div className="space-y-6">
              {/* CL Global */}
              {lbRes.global && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Global — Todas las categorías</p>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {([["LCL", lbRes.global.lcl], ["CL", lbRes.global.cl], ["UCL", lbRes.global.ucl]] as [string, number][]).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-2xl font-bold text-slate-200">{(v * 100).toFixed(1)}%</p>
                        <p className="text-xs text-slate-500">{k}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    n={lbRes.global.n} · σ={( lbRes.global.sigma * 100).toFixed(2)}% · CV={lbRes.global.cv.toFixed(1)}%
                  </p>
                </div>
              )}
              {/* Por categoría */}
              {Object.entries(lbRes.categorias).map(([cat, data]) => (
                <div key={cat} className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200">{cat}</p>
                    <span className="text-xs text-slate-500">σ = {(data.sigma * 100).toFixed(2)}%</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-slate-400">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          {["Período", "LCL", "CL", "UCL"].map((h) => (
                            <th key={h} className="pb-2 text-left font-medium text-slate-500">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.periodos.map((p) => (
                          <tr key={p.periodo} className="border-b border-white/[0.03]">
                            <td className="py-1.5 font-mono">P{p.periodo}</td>
                            <td className="py-1.5 text-rose-400">{(p.LCL * 100).toFixed(1)}%</td>
                            <td className="py-1.5 text-emerald-400 font-semibold">{(p.CL * 100).toFixed(1)}%</td>
                            <td className="py-1.5 text-rose-400">{(p.UCL * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DATA HISTÓRICA ───────────────────────────────────────── */}
      {tab === "historico" && (
        <div className="space-y-5">
          {notice && <LocalOnlyNotice message={notice} />}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}
          {loading && <p className="text-xs text-slate-500 animate-pulse">Cargando datos…</p>}
          {datosInfo && datosInfo.disponible && <DatosHistoricoPanel info={datosInfo} />}
          {datosInfo && !datosInfo.disponible && (
            <p className="text-sm text-slate-500">Excel de entrenamiento no disponible en el servidor.</p>
          )}
        </div>
      )}

      {tab === "marco" && <MarcoMedicion area="datos" />}
    </div>
  );
}

function DatosHistoricoPanel({ info }: { info: DatosInfoResponse }) {
  const cobColor = (v: number) =>
    v >= 0.90 ? "text-emerald-400" : v >= 0.70 ? "text-amber-400" : "text-rose-400";

  const [catFiltro, setCatFiltro] = useState<string>("Todas");
  const cats = ["Todas", ...Object.keys(info.por_categoria ?? {})];

  const registrosFiltrados = (info.registros ?? []).filter(
    (r: DatosInfoRegistro) => catFiltro === "Todas" || r.categoria === catFiltro
  );

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Observaciones",  val: String(info.n_obs ?? "—"),        color: "text-slate-200"  },
          { label: "Categorías",     val: String(info.n_categorias ?? "—"), color: "text-sky-400"    },
          { label: "Períodos",       val: String(info.n_periodos ?? "—"),   color: "text-indigo-400" },
          { label: "R² modelo",      val: info.modelo_r2 != null ? info.modelo_r2.toFixed(3) : "—", color: "text-emerald-400" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold tabular-nums ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Resumen por categoría */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Object.entries(info.por_categoria ?? {}).map(([cat, c]) => (
          <div key={cat} className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-300">{cat}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <span className="text-slate-500">Observaciones</span>
              <span className="text-slate-200 font-medium">{c.n_obs}</span>
              <span className="text-slate-500">Períodos</span>
              <span className="text-slate-200 font-medium">{c.n_periodos}</span>
              <span className="text-slate-500">Cobertura media</span>
              <span className={`font-medium ${cobColor(parseFloat(c.cob_media) / 100)}`}>{c.cob_media}</span>
              <span className="text-slate-500">Rango</span>
              <span className="text-slate-400">{c.cob_min} – {c.cob_max}</span>
              <span className="text-slate-500">Variables</span>
              <span className="text-slate-400 leading-tight">{c.variables.join(", ")}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filtro + tabla */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold text-slate-300 flex items-center gap-2"><span>📋</span> Registros históricos</p>
        <select value={catFiltro} onChange={e => setCatFiltro(e.target.value)}
          className="ml-auto px-2 py-1 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-slate-300 focus:outline-none">
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Categoría", "Variable", "Período", "Cobertura"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registrosFiltrados.map((r: DatosInfoRegistro, i: number) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                <td className="px-3 py-1.5 text-slate-400">{r.categoria}</td>
                <td className="px-3 py-1.5 text-slate-300">{r.variable}</td>
                <td className="px-3 py-1.5 text-slate-400 tabular-nums text-center">P{r.periodo}</td>
                <td className={`px-3 py-1.5 font-medium tabular-nums ${cobColor(r.cob_v)}`}>{r.cobertura}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinancieroOrigenPanel({ info }: { info: FinancieroInfoResponse }) {
  const utilColor = (v: number) =>
    v >= 0.20 ? "text-emerald-400" : v >= 0.05 ? "text-amber-400" : "text-rose-400";

  const cats = Object.entries(info.por_categoria ?? {});

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Datos hasta",     val: info.fecha_max ?? "—",         color: "text-sky-400"      },
          { label: "Desde",           val: info.fecha_min ?? "—",         color: "text-slate-400"    },
          { label: "Proyectos",       val: String(info.n_proyectos ?? "—"), color: "text-slate-200"  },
          { label: "R² ajustado",     val: info.modelo_r2a != null ? `${(info.modelo_r2a * 100).toFixed(1)}%` : "—", color: "text-indigo-400" },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
            <p className={`text-xl font-bold tabular-nums ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Resumen por categoría */}
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <span className="text-base">📂</span> Por categoría
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cats.map(([cat, c]) => (
          <div key={cat} className="bg-white/[0.04] rounded-xl border border-white/[0.08] p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-300 leading-tight">{cat}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <span className="text-slate-500">Proyectos</span>
              <span className="text-slate-200 font-medium">{c.n}</span>
              <span className="text-slate-500">Utilidad media</span>
              <span className={`font-medium ${utilColor(parseFloat(c.utilidad_media) / 100)}`}>{c.utilidad_media}</span>
              <span className="text-slate-500">Rango</span>
              <span className="text-slate-400">{c.utilidad_min} – {c.utilidad_max}</span>
              {c.monto_medio_mm != null && <>
                <span className="text-slate-500">Monto medio</span>
                <span className="text-slate-400">${c.monto_medio_mm.toFixed(0)} M</span>
              </>}
            </div>
          </div>
        ))}
      </div>

      {/* Tabla de proyectos */}
      <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
        <span className="text-base">📋</span> Proyectos históricos
      </h3>
      <div className="bg-white/[0.03] rounded-xl border border-white/[0.08] overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Código", "Categoría", "Fecha cierre", "Utilidad", "Monto (M COP)"].map(h => (
                <th key={h} className="px-3 py-2 text-left text-slate-500 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(info.proyectos ?? []).map((p: FinancieroInfoProyecto, i: number) => (
              <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                <td className="px-3 py-1.5 font-mono text-slate-400">{p.codigo}</td>
                <td className="px-3 py-1.5 text-slate-300">{p.categoria}</td>
                <td className="px-3 py-1.5 text-slate-400 tabular-nums">{p.fecha ?? "—"}</td>
                <td className={`px-3 py-1.5 font-medium tabular-nums ${utilColor(p.utilidad_v)}`}>{p.utilidad}</td>
                <td className="px-3 py-1.5 text-slate-400 text-right tabular-nums">{p.monto_mm != null ? `$${p.monto_mm.toFixed(0)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Placeholder verticales pendientes ─────────────────────────────── */
function PendingPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 mt-16 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/[0.05] text-slate-500">
        <ShieldCheck size={26} />
      </div>
      <p className="text-sm font-semibold text-slate-400">Vertical {label}</p>
      <p className="text-xs text-slate-500 max-w-xs">
        Próximamente. Cada vertical se gestiona con su propio Excel; empezamos por Comercial.
      </p>
    </div>
  );
}

/* ── Módulo principal ──────────────────────────────────────────────── */
export default function CMMIView() {
  const [vertical, setVertical] = useState<Vertical>("comercial");
  const active = VERTICALES.find((v) => v.id === vertical)!;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Topbar title="CMMI" subtitle="Gestión y registro por vertical · Comercial, Financiero, PMO, Datos" />
      <main className="flex-1 p-6 space-y-5">
        {/* Pills de verticales */}
        <div className="flex items-center gap-2 flex-wrap">
          {VERTICALES.map((v) => {
            const isActive = v.id === vertical;
            return (
              <button
                key={v.id}
                onClick={() => setVertical(v.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-white/[0.04] text-slate-400 border border-white/[0.07] hover:bg-white/[0.08] hover:text-slate-200"
                }`}
              >
                {v.label}
                {!v.enabled && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? "bg-blue-500 text-blue-100" : "bg-white/[0.06] text-slate-500"}`}>
                    pronto
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {active.id === "comercial"  && active.enabled ? <ComercialPanel />   :
         active.id === "proyectos"  && active.enabled ? <ProyectosPanel />   :
         active.id === "financiero" && active.enabled ? <FinancieroPanel />  :
         active.id === "datos"      && active.enabled ? <DatosPanel />       :
         <PendingPanel label={active.label} />}
      </main>
    </div>
  );
}
