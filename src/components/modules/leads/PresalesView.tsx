"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { RefreshCw, AlertCircle, Loader2, X, UserCog } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import FilterSelect from "./FilterSelect";
import DateRangeSlider from "./DateRangeSlider";
import { uniqueEtapaActual } from "./etapaOrder";
import LeadDetailModal from "./LeadDetailModal";
import PresalesManageModal, { type PresalesStatusRow } from "./PresalesManageModal";

/* ── constantes de gestión ───────────────────────────────────────────── */
const DAY_MS     = 86400000;
const STALE_DAYS = 14;   // sin modificaciones → estancado
const SOON_DAYS  = 15;   // cierre esperado dentro de N días → próximo

/* ── helpers ─────────────────────────────────────────────────────────── */
const parseDate = (s: string): Date | null => {
  if (!s) return null;
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
};

const fmtCOP = (v: number) => {
  if (!v) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)} M`;
  return `$${Math.round(v).toLocaleString("es-CO")}`;
};

const unique = (arr: string[]) => ["ALL", ...Array.from(new Set(arr.filter(Boolean))).sort()];
const normText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

const CARD = "relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] backdrop-blur-xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45)] overflow-hidden";

function Card({ title, right, children, className = "" }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`${CARD} p-4 ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
      <div className="relative flex items-center justify-between gap-2 mb-3">
        <h3 className="text-xs font-semibold text-slate-100 uppercase tracking-wide">{title}</h3>
        {right}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

function Kpi({ label, value, hint, tone = "blue" }: { label: string; value: string; hint?: string; tone?: "blue" | "amber" | "rose" | "emerald" }) {
  const dot = { blue: "bg-blue-400", amber: "bg-amber-400", rose: "bg-rose-400", emerald: "bg-emerald-400" }[tone];
  return (
    <div className={`${CARD} p-4`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        </div>
        <p className="text-xl font-bold text-slate-100 mt-1.5 tabular-nums leading-none whitespace-nowrap">{value}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-1.5">{hint}</p>}
      </div>
    </div>
  );
}

// etapas de preventa que no se muestran como columna en Carga por preventa (valores normalizados)
const HIDDEN_ETAPA_COLS = new Set(["oferta declinada", "no viable", "oferta no viable", "suspendida", "sin etapa"]);

type QueueKey = "sinAsignar" | "inactivos" | "estancados" | "proximos";

/* ── vista ───────────────────────────────────────────────────────────── */
// popup con la tabla de leads (el mismo de la pestaña Business); se recibe por prop para no crear un import circular
export type LeadsListModalType = ComponentType<{ leads: Lead[]; title?: string; heading?: string; suffix?: string; onClose: () => void }>;

export default function PresalesView({
  leads, loading, error, onReload, LeadsListModal,
}: { leads: Lead[]; loading: boolean; error: string | null; onReload: () => void; LeadsListModal: LeadsListModalType }) {
  const [listModal, setListModal] = useState<{ leads: Lead[]; heading: string } | null>(null);
  const [fPreventa, setFPreventa] = useState("ALL");
  const [fLinea,    setFLinea]    = useState("ALL");
  // por defecto: Etapa Actual = Preventa, Estado Preventa = ABIERTO (se pueden cambiar libremente)
  const [fEtapa,    setFEtapa]    = useState("ABIERTO");
  const [fEstado,   setFEstado]   = useState("Preventa");
  const [dFrom,     setDFrom]     = useState("");
  const [dTo,       setDTo]       = useState("");
  const [queue,     setQueue]     = useState<QueueKey>("sinAsignar");
  const [selected,  setSelected]  = useState<Lead | null>(null);

  /* estado activo/inactivo de cada preventa (gestionado desde esta página) */
  const [statuses,   setStatuses]   = useState<Record<string, PresalesStatusRow>>({});
  const [canManage,  setCanManage]  = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [onlyActive, setOnlyActive] = useState(true);
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    fetch("/api/presales/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setStatuses(Object.fromEntries((d.statuses as PresalesStatusRow[]).map((s) => [s.name, s])));
        setCanManage(!!d.canManage);
        setNeedsSetup(!!d.needsSetup);
      })
      .catch(() => {});
  }, []);

  const isInactive = (name: string) => statuses[name]?.active === false;

  async function saveStatuses(changes: { name: string; active: boolean }[]) {
    const res = await fetch("/api/presales/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
    const saved = json.statuses as PresalesStatusRow[];
    setStatuses((prev) => ({ ...prev, ...Object.fromEntries(saved.map((s) => [s.name, s])) }));
    setNeedsSetup(false);
  }

  /* universo de preventa: leads con preventa asignado o con etapa de preventa */
  const scope = useMemo(() => leads.filter((l) => l.preventa || l.etapaPreventa), [leads]);

  const opts = useMemo(() => ({
    preventa:    unique(scope.map((l) => l.preventa).filter((n) => !onlyActive || statuses[n]?.active !== false)),
    linea:       unique(scope.map((l) => l.linea)),
    etapaPreventa: unique(scope.map((l) => l.etapaPreventa)),
    etapaActual: uniqueEtapaActual(scope.map((l) => l.etapa)),
  }), [scope, onlyActive, statuses]);

  const filtered = useMemo(() => scope.filter((l) =>
    (fPreventa === "ALL" || l.preventa === fPreventa) &&
    (fLinea    === "ALL" || l.linea === fLinea) &&
    (fEtapa    === "ALL" || l.etapaPreventa === fEtapa) &&
    (fEstado   === "ALL" || l.etapa === fEstado) &&
    (!dFrom || l.fechaCreacion >= dFrom) &&
    (!dTo   || l.fechaCreacion.substring(0, 10) <= dTo)
  ), [scope, fPreventa, fLinea, fEtapa, fEstado, dFrom, dTo]);

  // igual que "filtered" pero sin el filtro Estado Preventa — para el widget que grafica justamente ese campo,
  // que si no se veria siempre reducido a un solo valor por el propio filtro
  const filteredAnyEstadoPreventa = useMemo(() => scope.filter((l) =>
    (fPreventa === "ALL" || l.preventa === fPreventa) &&
    (fLinea    === "ALL" || l.linea === fLinea) &&
    (fEstado   === "ALL" || l.etapa === fEstado) &&
    (!dFrom || l.fechaCreacion >= dFrom) &&
    (!dTo   || l.fechaCreacion.substring(0, 10) <= dTo)
  ), [scope, fPreventa, fLinea, fEstado, dFrom, dTo]);

  /* límites del slider de fecha — del primer lead cargado a hoy (igual que Business) */
  const dateBounds = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    const days = scope.map((l) => l.fechaCreacion.substring(0, 10)).filter(Boolean).sort();
    if (!days.length) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return { min: d.toISOString().substring(0, 10), max: today };
    }
    return { min: days[0], max: days[days.length - 1] > today ? days[days.length - 1] : today };
  }, [scope]);

  const activeFilters = [fPreventa, fLinea, fEtapa, fEstado].filter((v) => v !== "ALL").length + (dFrom || dTo ? 1 : 0);
  const clearFilters = () => { setFPreventa("ALL"); setFLinea("ALL"); setFEtapa("ALL"); setFEstado("ALL"); setDFrom(""); setDTo(""); };

  const [now] = useState(() => Date.now());
  const daysSince = (l: Lead) => {
    const d = parseDate(l.ultimaModificacion);
    return d ? Math.floor((now - d.getTime()) / DAY_MS) : 0;
  };
  const daysToClose = (l: Lead) => {
    const d = parseDate(l.cierreEsperado);
    return d ? Math.ceil((d.getTime() - now) / DAY_MS) : null;
  };
  // "Abierto" = el campo Etapa Prev. está en Abierto
  const isOpen = (l: Lead) => normText(l.etapaPreventa) === "abierto";

  /* KPIs */
  const stats = useMemo(() => {
    const open    = filtered.filter(isOpen);
    const won     = filtered.filter((l) => l.ganado === "Ganado");
    const lost    = filtered.filter((l) => l.ganado === "Perdido");
    const sinAsig = open.filter((l) => !l.preventa);
    const stale   = open.filter((l) => daysSince(l) > STALE_DAYS);
    const soon    = open.filter((l) => { const d = daysToClose(l); return d !== null && d >= 0 && d <= SOON_DAYS; });
    return {
      total: filtered.length, open, won, lost, sinAsig, stale, soon,
      pipeline: open.reduce((s, l) => s + l.ingresosEsperados, 0),
      winRate: pct(won.length, won.length + lost.length),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  /* carga por preventa */
  // Una columna por cada valor real del campo Etapa Prev. (además de Abierto), en vez de valores supuestos.
  const { byPreventa, etapaCols } = useMemo(() => {
    type Row = { name: string; open: number; won: number; lost: number; pipeline: number; stale: number; counts: Record<string, number> };
    const map = new Map<string, Row>();
    const labels = new Map<string, string>();   // valor normalizado → etiqueta original
    const totals = new Map<string, number>();
    for (const l of filtered) {
      const name = l.preventa || "Sin asignar";
      const r = map.get(name) ?? { name, open: 0, won: 0, lost: 0, pipeline: 0, stale: 0, counts: {} };
      if (l.ganado === "Ganado") r.won++;
      else if (l.ganado === "Perdido") r.lost++;
      const key = normText(l.etapaPreventa) || "sin etapa";
      if (!labels.has(key)) labels.set(key, l.etapaPreventa || "Sin etapa");
      totals.set(key, (totals.get(key) ?? 0) + 1);
      r.counts[key] = (r.counts[key] ?? 0) + 1;
      if (isOpen(l)) { r.open++; r.pipeline += l.ingresosEsperados; if (daysSince(l) > STALE_DAYS) r.stale++; }
      map.set(name, r);
    }
    const cols = [...totals.keys()]
      .filter((k) => k !== "abierto" && !HIDDEN_ETAPA_COLS.has(k))
      .sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0))
      .map((k) => ({ key: k, label: labels.get(k) ?? k }));
    const rows = [...map.values()].sort((a, b) => b.open - a.open || Object.values(b.counts).reduce((s, n) => s + n, 0) - Object.values(a.counts).reduce((s, n) => s + n, 0));
    return { byPreventa: rows, etapaCols: cols };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);
  // con "Solo activos" la tabla oculta a los inactivos; los indicadores de arriba conservan el histórico completo
  const tableRows = onlyActive ? byPreventa.filter((r) => !isInactive(r.name)) : byPreventa;
  const maxOpen = Math.max(1, ...tableRows.map((r) => r.open));

  const totals = {
    open:     tableRows.reduce((s, r) => s + r.open, 0),
    won:      tableRows.reduce((s, r) => s + r.won, 0),
    lost:     tableRows.reduce((s, r) => s + r.lost, 0),
    pipeline: tableRows.reduce((s, r) => s + r.pipeline, 0),
    stale:    tableRows.reduce((s, r) => s + r.stale, 0),
    counts:   Object.fromEntries(etapaCols.map((c) => [c.key, tableRows.reduce((s, r) => s + (r.counts[c.key] ?? 0), 0)])) as Record<string, number>,
  };
  const totalRate = pct(totals.won, totals.won + totals.lost);

  /* personas para la ventana de gestión: todos los preventas de ODOO, sin depender de los filtros */
  const people = useMemo(() => {
    const map = new Map<string, { name: string; open: number; total: number }>();
    for (const l of scope) {
      if (!l.preventa) continue;
      const r = map.get(l.preventa) ?? { name: l.preventa, open: 0, total: 0 };
      r.total++;
      if (normText(l.etapaPreventa) === "abierto") r.open++;
      map.set(l.preventa, r);
    }
    return [...map.values()];
  }, [scope]);

  /* Estado Preventa (todas las etapas) — respeta "Solo activos" pero no el propio filtro Estado Preventa */
  const etapaScope = useMemo(
    () => onlyActive ? filteredAnyEstadoPreventa.filter((l) => !l.preventa || !isInactive(l.preventa)) : filteredAnyEstadoPreventa,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredAnyEstadoPreventa, onlyActive, statuses],
  );
  const byEtapa = useMemo(() => {
    const map = new Map<string, { name: string; count: number; open: number; pipeline: number; days: number }>();
    for (const l of etapaScope) {
      const name = l.etapaPreventa || "Sin etapa";
      const r = map.get(name) ?? { name, count: 0, open: 0, pipeline: 0, days: 0 };
      r.count++;
      if (isOpen(l)) { r.open++; r.pipeline += l.ingresosEsperados; r.days += daysSince(l); }
      map.set(name, r);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapaScope]);
  const maxEtapa = Math.max(1, ...byEtapa.map((r) => r.count));

  /* ingreso mensual de leads a preventa (últimos 6 meses) */
  const monthly = useMemo(() => {
    const base = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""), created: 0, won: 0 };
    });
    for (const l of filtered) {
      const m = months.find((x) => x.key === l.fechaCreacion.substring(0, 7));
      if (!m) continue;
      m.created++;
      if (l.ganado === "Ganado") m.won++;
    }
    return months;
  }, [filtered]);
  const maxMonth = Math.max(1, ...monthly.map((m) => m.created));

  /* cola de gestión */
  const queues: Record<QueueKey, { label: string; items: Lead[]; hint: (l: Lead) => string }> = {
    sinAsignar: { label: "Sin preventa", items: stats.sinAsig, hint: (l) => `${daysSince(l)} d sin cambios` },
    inactivos:  { label: "Preventa inactivo", items: stats.open.filter((l) => !!l.preventa && isInactive(l.preventa)), hint: (l) => `${daysSince(l)} d sin cambios` },
    estancados: { label: `Estancados +${STALE_DAYS} d`, items: [...stats.stale].sort((a, b) => daysSince(b) - daysSince(a)), hint: (l) => `${daysSince(l)} d sin cambios` },
    proximos:   { label: `Cierre ≤ ${SOON_DAYS} d`, items: [...stats.soon].sort((a, b) => (daysToClose(a) ?? 0) - (daysToClose(b) ?? 0)), hint: (l) => `cierra en ${daysToClose(l)} d` },
  };
  const q = queues[queue];

  return (
    <div className="flex-1 overflow-auto p-5 space-y-4 relative">
      {/* filtros */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <FilterSelect label="Línea"          value={fLinea}    onChange={setFLinea}    options={opts.linea} />
        <FilterSelect label="Preventa"       value={fPreventa} onChange={setFPreventa} options={opts.preventa} />
        <FilterSelect label="Etapa Actual"   value={fEstado}   onChange={setFEstado}   options={opts.etapaActual} />
        <FilterSelect label="Estado Preventa" value={fEtapa}   onChange={setFEtapa}    options={opts.etapaPreventa}
          headerAction={activeFilters > 0 && (
            <button type="button" onClick={clearFilters} title={`Limpiar filtros (${activeFilters})`} className="text-slate-500 hover:text-rose-400 transition-colors">
              <X size={11} />
            </button>
          )} />

        <div className="w-px self-stretch bg-white/[0.08] shrink-0 mx-0.5" />

        <DateRangeSlider
          min={dateBounds.min}
          max={dateBounds.max}
          from={dFrom}
          to={dTo}
          onChange={(from, to) => { setDFrom(from); setDTo(to); }}
        />

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setOnlyActive((v) => !v)}
            title="Oculta a los preventas inactivos en la tabla de carga y en el filtro Preventa"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              onlyActive ? "filter-option-selected border-blue-500/40" : "filter-option bg-white/[0.04] border-white/[0.1] text-slate-400"
            }`}>
            Solo activos
          </button>
          {canManage && (
            <button type="button" onClick={() => setShowManage(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 border border-white/[0.1] hover:bg-white/[0.05] transition-colors">
              <UserCog size={13} /> Gestionar preventas
            </button>
          )}
          <button onClick={onReload} disabled={loading} title="Actualizar"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 border border-white/[0.1] hover:bg-white/[0.05] disabled:opacity-60 transition-colors">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>

      {canManage && needsSetup && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          La tabla presales_status aún no está creada en Supabase, por eso todos los preventas figuran como activos. Ejecuta supabase/migrations/20260921_presales_status.sql en el SQL Editor.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading && leads.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-24 text-slate-500 text-sm">
          <Loader2 size={18} className="animate-spin" /> Cargando preventas…
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <Kpi label="En preventa"     value={String(stats.total)} hint="Total de leads" />
            <Kpi label="Preventa abierta" value={String(totals.open)} />
            <Kpi label="Pipeline abierto" value={fmtCOP(stats.pipeline)} hint="Ingresos esperados" />
            <Kpi label="Tasa de éxito"   value={stats.winRate === null ? "—" : `${stats.winRate}%`} hint={`${stats.won.length} ganados · ${stats.lost.length} perdidos`} tone="emerald" />
            <Kpi label="Sin preventa"    value={String(stats.sinAsig.length)} hint="Abiertos sin responsable" tone="amber" />
            <Kpi label="Estancados"      value={String(stats.stale.length)} hint={`Más de ${STALE_DAYS} días sin cambios`} tone="rose" />
            <Kpi label="Cierre próximo"  value={String(stats.soon.length)} hint={`En ${SOON_DAYS} días o menos`} tone="amber" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* carga por preventa */}
            <Card title="Carga por preventa" className="xl:col-span-3"
              right={<span className="text-[10px] text-slate-500">Clic para ver los abiertos</span>}>
              {tableRows.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Sin datos</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="text-left font-semibold pb-2 pr-3">Preventa</th>
                        <th className="text-left font-semibold pb-2 pr-3 w-36">Abiertos</th>
                        {etapaCols.map((c) => (
                          <th key={c.key} className="text-right font-semibold pb-2 px-2 whitespace-nowrap">{c.label}</th>
                        ))}
                        <th className="text-right font-semibold pb-2 px-2">Éxito</th>
                        <th className="text-right font-semibold pb-2 px-2">Pipeline</th>
                        <th className="text-right font-semibold pb-2 pl-2">Estancados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {tableRows.map((r) => {
                        const rate = pct(r.won, r.won + r.lost);
                        return (
                          <tr key={r.name}
                            onClick={() => setListModal({ leads: filtered.filter((l) => isOpen(l) && (l.preventa || "Sin asignar") === r.name), heading: r.name })}
                            className="transition-colors cursor-pointer hover:bg-white/[0.05]">
                            <td className={`py-2 pr-3 font-medium truncate max-w-[180px] ${r.name === "Sin asignar" ? "text-amber-400" : "text-slate-200"}`} title={r.name}>{r.name}</td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(r.open / maxOpen) * 100}%` }} />
                                </div>
                                <span className="w-6 text-right tabular-nums text-slate-300">{r.open}</span>
                              </div>
                            </td>
                            {etapaCols.map((c) => {
                              const n = r.counts[c.key] ?? 0;
                              return (
                                <td key={c.key} className={`py-2 px-2 text-right tabular-nums ${n === 0 ? "text-slate-600" : c.key === "ganado" ? "text-emerald-400" : "text-slate-300"}`}>{n}</td>
                              );
                            })}
                            <td className="py-2 px-2 text-right tabular-nums text-slate-300">{rate === null ? "—" : `${rate}%`}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-slate-300 whitespace-nowrap">{fmtCOP(r.pipeline)}</td>
                            <td className={`py-2 pl-2 text-right tabular-nums ${r.stale > 0 ? "text-rose-400 font-semibold" : "text-slate-500"}`}>{r.stale}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr
                        onClick={() => {
                          const names = new Set(tableRows.map((r) => r.name));
                          setListModal({ leads: filtered.filter((l) => isOpen(l) && names.has(l.preventa || "Sin asignar")), heading: "Total" });
                        }}
                        className="border-t border-white/[0.14] font-semibold cursor-pointer hover:bg-white/[0.05] transition-colors">
                        <td className="pt-2.5 pr-3 text-slate-200 uppercase text-[10px] tracking-wide">Total</td>
                        <td className="pt-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1" />
                            <span className="w-6 text-right tabular-nums text-slate-100">{totals.open}</span>
                          </div>
                        </td>
                        {etapaCols.map((c) => (
                          <td key={c.key} className="pt-2.5 px-2 text-right tabular-nums text-slate-100">{totals.counts[c.key]}</td>
                        ))}
                        <td className="pt-2.5 px-2 text-right tabular-nums text-slate-100">{totalRate === null ? "—" : `${totalRate}%`}</td>
                        <td className="pt-2.5 px-2 text-right tabular-nums text-slate-100 whitespace-nowrap">{fmtCOP(totals.pipeline)}</td>
                        <td className="pt-2.5 pl-2 text-right tabular-nums text-slate-100">{totals.stale}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Card>

            {/* embudo por etapa */}
            <Card title="Estado Preventa" className="xl:col-span-2"
              right={<span className="text-[10px] text-slate-500">Prom. días sin cambios</span>}>
              {byEtapa.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Sin datos</p>
              ) : (
                <div className="space-y-2.5">
                  {byEtapa.map((r) => (
                    <button key={r.name} type="button"
                      onClick={() => r.name !== "Sin etapa" && setFEtapa(fEtapa === r.name ? "ALL" : r.name)}
                      className="w-full text-left group">
                      <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
                        <span className="text-slate-200 font-medium truncate group-hover:text-white transition-colors" title={r.name}>{r.name}</span>
                        <span className="shrink-0 text-slate-500 tabular-nums">
                          <span className="text-slate-300">{r.count}</span>
                          {r.open > 0 && <> · {fmtCOP(r.pipeline)} · {Math.round(r.days / r.open)} d</>}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(r.count / maxEtapa) * 100}%` }} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* cola de gestión operativa */}
            <Card title="Cola de gestión" className="xl:col-span-3"
              right={
                <div className="flex gap-1">
                  {(Object.keys(queues) as QueueKey[]).map((k) => (
                    <button key={k} type="button" onClick={() => setQueue(k)}
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors whitespace-nowrap ${
                        queue === k ? "filter-option-selected border-blue-500/40" : "filter-option bg-white/[0.04] border-white/[0.08] text-slate-400"
                      }`}>
                      {queues[k].label} <span className="tabular-nums opacity-70">{queues[k].items.length}</span>
                    </button>
                  ))}
                </div>
              }>
              {q.items.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Nada pendiente en esta cola</p>
              ) : (
                <div className="divide-y divide-white/[0.05]">
                  {q.items.slice(0, 8).map((l) => (
                    <button key={l.id} type="button" onClick={() => setSelected(l)}
                      className="w-full flex items-center gap-3 text-left px-1.5 py-2 hover:bg-white/[0.05] rounded-lg transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-100 truncate" title={l.nombre}>{l.nombre}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {l.cliente || "—"}{l.preventa ? ` · ${l.preventa}` : ""}{l.etapaPreventa ? ` · ${l.etapaPreventa}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-slate-300 tabular-nums">{fmtCOP(l.ingresosEsperados)}</p>
                        <p className="text-[10px] text-slate-500 whitespace-nowrap">{q.hint(l)}</p>
                      </div>
                    </button>
                  ))}
                  {q.items.length > 8 && (
                    <p className="text-[10px] text-slate-500 text-center pt-2">+{q.items.length - 8} más — ajusta los filtros para acotar</p>
                  )}
                </div>
              )}
            </Card>

            {/* leads por mes */}
            <Card title="Ingreso mensual" className="xl:col-span-2"
              right={<span className="text-[10px] text-slate-500">Últimos 6 meses</span>}>
              <div className="flex items-end gap-2 h-36">
                {monthly.map((m) => (
                  <div key={m.key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
                    <span className="text-[10px] text-slate-400 tabular-nums">{m.created || ""}</span>
                    <div className="w-full flex-1 flex items-end">
                      <div className="w-full rounded-t-md bg-blue-500/70 relative overflow-hidden" style={{ height: `${(m.created / maxMonth) * 100}%`, minHeight: m.created ? 4 : 0 }}>
                        {m.won > 0 && <div className="absolute bottom-0 inset-x-0 bg-emerald-400" style={{ height: `${(m.won / m.created) * 100}%` }} />}
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 capitalize">{m.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/70" /> Creados</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-400" /> Ganados</span>
              </div>
            </Card>
          </div>
        </>
      )}

      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} />}
      {listModal && (
        <LeadsListModal
          leads={listModal.leads}
          title="Leads de preventa"
          heading={listModal.heading}
          suffix=" con Etapa Prev. abierta"
          onClose={() => setListModal(null)}
        />
      )}
      {showManage && (
        <PresalesManageModal people={people} statuses={statuses} onSave={saveStatuses} onClose={() => setShowManage(false)} />
      )}
    </div>
  );
}
