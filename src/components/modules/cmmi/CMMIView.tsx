"use client";

import { useMemo, useRef, useState } from "react";
import {
  ShieldCheck, Upload, FileSpreadsheet, X, Search,
  DollarSign, Trophy, TrendingDown, Clock, Layers, AlertCircle,
  Table2, Activity, Cpu, Play, Maximize2, Filter,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import {
  VERTICALES, type Vertical, type OportunidadComercial, type ParseResult,
  type SpcResponse, type RfTrainResponse, type CuracionMeta,
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
function RunnerHeader({ icon: Icon, title, desc, loading, done, onRun }: {
  icon: typeof Activity; title: string; desc: string; loading: boolean; done: boolean; onRun: () => void;
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
        {loading ? "Ejecutando…" : done ? "Volver a ejecutar" : "Ejecutar modelo"}
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
        loading={loading} done={!!res} onRun={run}
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
            <RecordTable rows={res.tables.predictions} />
          </div>
        </div>
      )}
    </div>
  );
}

type ComercialTab = "datos" | "spc" | "rf";

/* ── Vista COMERCIAL ───────────────────────────────────────────────── */
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
    return <UploadZone onFile={handleFile} loading={loading} error={error} />;
  }

  const tabs: { id: ComercialTab; label: string; icon: typeof Table2 }[] = [
    { id: "datos", label: "Datos",               icon: Table2   },
    { id: "spc",   label: "SPC · Carta P (PPB)", icon: Activity },
    { id: "rf",    label: "Random Forest (PPM)", icon: Cpu      },
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

      {tab === "spc" && rawFile && <SpcRunner file={rawFile} />}
      {tab === "rf"  && rawFile && <RfRunner  file={rawFile} />}

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

        {active.enabled ? <ComercialPanel /> : <PendingPanel label={active.label} />}
      </main>
    </div>
  );
}
