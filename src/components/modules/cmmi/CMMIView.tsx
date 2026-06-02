"use client";

import { useMemo, useRef, useState } from "react";
import {
  ShieldCheck, Upload, FileSpreadsheet, X, Search,
  DollarSign, Trophy, TrendingDown, Clock, Layers, AlertCircle,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { VERTICALES, type Vertical, type OportunidadComercial, type ParseResult } from "@/lib/cmmi/types";
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
  if (k.startsWith("GANAD"))    return "bg-emerald-100 text-emerald-700";
  if (k.startsWith("PERDID"))   return "bg-rose-100 text-rose-700";
  if (k.startsWith("DECLINAD")) return "bg-slate-100 text-slate-500";
  return "bg-amber-100 text-amber-700"; // Pendiente / otros
}

const LINEA_BADGE: Record<string, string> = {
  "CONSULTORÍA": "bg-violet-100 text-violet-700",
  "TI":          "bg-sky-100 text-sky-700",
};
function lineaBadge(l: string): string {
  const k = l.toUpperCase();
  if (k.startsWith("CONSULTOR")) return LINEA_BADGE["CONSULTORÍA"];
  if (k === "TI")                return LINEA_BADGE["TI"];
  if (k.startsWith("DATOS"))     return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

/* ── KPI card ──────────────────────────────────────────────────────── */
function Kpi({ icon: Icon, label, value, tint }: {
  icon: typeof DollarSign; label: string; value: string; tint: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${tint}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-800 leading-tight truncate">{value}</p>
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
          drag ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600">
          {loading ? <Clock size={26} className="animate-spin" /> : <Upload size={26} />}
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {loading ? "Procesando archivo…" : "Arrastra el Excel de Comercial aquí"}
        </p>
        <p className="text-xs text-slate-400">o haz clic para seleccionar · .xlsx / .xls</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
      </div>
      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
    </div>
  );
}

/* ── Vista COMERCIAL ───────────────────────────────────────────────── */
function ComercialPanel() {
  const [data, setData] = useState<ParseResult | null>(null);
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

  return (
    <div className="space-y-5">
      {/* Encabezado de archivo */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5 text-sm text-slate-600">
          <FileSpreadsheet size={18} className="text-emerald-600" />
          <span className="font-medium text-slate-800">{data.fileName}</span>
          <span className="text-slate-400">· {data.rowCount.toLocaleString("es-CO")} oportunidades</span>
        </div>
        <button
          onClick={() => { setData(null); setError(null); setSearch(""); setFLinea(""); setFSegmento(""); setFEstado(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <X size={13} /> Cargar otro archivo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi icon={Layers}      label="Oportunidades" value={kpis.total.toLocaleString("es-CO")} tint="bg-blue-50 text-blue-600" />
        <Kpi icon={Trophy}      label="Ganadas"       value={kpis.ganadas.toLocaleString("es-CO")} tint="bg-emerald-50 text-emerald-600" />
        <Kpi icon={TrendingDown}label="Perdidas"      value={kpis.perdidas.toLocaleString("es-CO")} tint="bg-rose-50 text-rose-600" />
        <Kpi icon={Clock}       label="Pendientes"    value={kpis.pendientes.toLocaleString("es-CO")} tint="bg-amber-50 text-amber-600" />
        <Kpi icon={DollarSign}  label="Ingreso esp."  value={fmtCompact(kpis.ingreso)} tint="bg-violet-50 text-violet-600" />
        <Kpi icon={DollarSign}  label="Ticket prom."  value={fmtCompact(kpis.ticket)} tint="bg-cyan-50 text-cyan-600" />
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2.5 flex-wrap bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar oportunidad, cliente, comercial…"
            className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-72"
          />
        </div>
        <select value={fLinea} onChange={(e) => setFLinea(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas las líneas</option>
          {opciones.lineas.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={fSegmento} onChange={(e) => setFSegmento(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los segmentos</option>
          {opciones.segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          {opciones.estados.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={() => { setSearch(""); setFLinea(""); setFSegmento(""); setFEstado(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors">
            <X size={13} /> Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length.toLocaleString("es-CO")} resultados</span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Oportunidad", "Cliente", "Comercial", "Línea", "Segmento", "Ingreso esp.", "Estado", "Etapa actual", "Creado"].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((r) => (
                <tr key={r.rowId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[260px] truncate" title={r.oportunidad}>{r.oportunidad || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[220px] truncate" title={r.cliente}>{r.cliente || "—"}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">{r.comercial || "—"}</td>
                  <td className="px-4 py-3">{r.linea ? <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lineaBadge(r.linea)}`}>{r.linea}</span> : "—"}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{r.segmento || "—"}</td>
                  <td className="px-4 py-3 text-right text-slate-700 whitespace-nowrap tabular-nums">{fmtCOP(r.ingresoEsperado)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${estadoBadge(r.ganado)}`}>{r.ganado || "—"}</span></td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[180px] truncate" title={r.etapaActual}>{r.etapaActual || "—"}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(r.creado)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-400">No hay oportunidades que coincidan con los filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Placeholder verticales pendientes ─────────────────────────────── */
function PendingPanel({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 mt-16 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-400">
        <ShieldCheck size={26} />
      </div>
      <p className="text-sm font-semibold text-slate-600">Vertical {label}</p>
      <p className="text-xs text-slate-400 max-w-xs">
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
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {v.label}
                {!v.enabled && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? "bg-blue-500 text-blue-50" : "bg-slate-100 text-slate-400"}`}>
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
