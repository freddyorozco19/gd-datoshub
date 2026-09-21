"use client";

import { useMemo, useState, type ReactNode } from "react";
import { RefreshCw, AlertCircle, Loader2, X } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import FilterSelect from "./FilterSelect";
import LeadDetailModal from "./LeadDetailModal";

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
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)} mil M`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)} M`;
  return `$${Math.round(v).toLocaleString("es-CO")}`;
};

const unique = (arr: string[]) => ["ALL", ...Array.from(new Set(arr.filter(Boolean))).sort()];
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
        <p className="text-2xl font-bold text-slate-100 mt-1.5 tabular-nums leading-none">{value}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-1.5">{hint}</p>}
      </div>
    </div>
  );
}

const ESTADO_OPTS = ["ALL", "Pendiente", "Ganado", "Perdido"];
type QueueKey = "sinAsignar" | "estancados" | "proximos";

/* ── vista ───────────────────────────────────────────────────────────── */
export default function PresalesView({
  leads, loading, error, onReload,
}: { leads: Lead[]; loading: boolean; error: string | null; onReload: () => void }) {
  const [fPreventa, setFPreventa] = useState("ALL");
  const [fLinea,    setFLinea]    = useState("ALL");
  const [fEtapa,    setFEtapa]    = useState("ALL");
  const [fEstado,   setFEstado]   = useState("ALL");
  const [queue,     setQueue]     = useState<QueueKey>("sinAsignar");
  const [selected,  setSelected]  = useState<Lead | null>(null);

  /* universo de preventa: leads con preventa asignado o con etapa de preventa */
  const scope = useMemo(() => leads.filter((l) => l.preventa || l.etapaPreventa), [leads]);

  const opts = useMemo(() => ({
    preventa: unique(scope.map((l) => l.preventa)),
    linea:    unique(scope.map((l) => l.linea)),
    etapa:    unique(scope.map((l) => l.etapaPreventa)),
  }), [scope]);

  const filtered = useMemo(() => scope.filter((l) =>
    (fPreventa === "ALL" || l.preventa === fPreventa) &&
    (fLinea    === "ALL" || l.linea === fLinea) &&
    (fEtapa    === "ALL" || l.etapaPreventa === fEtapa) &&
    (fEstado   === "ALL" || l.ganado === fEstado)
  ), [scope, fPreventa, fLinea, fEtapa, fEstado]);

  const activeFilters = [fPreventa, fLinea, fEtapa, fEstado].filter((v) => v !== "ALL").length;
  const clearFilters = () => { setFPreventa("ALL"); setFLinea("ALL"); setFEtapa("ALL"); setFEstado("ALL"); };

  const [now] = useState(() => Date.now());
  const daysSince = (l: Lead) => {
    const d = parseDate(l.ultimaModificacion);
    return d ? Math.floor((now - d.getTime()) / DAY_MS) : 0;
  };
  const daysToClose = (l: Lead) => {
    const d = parseDate(l.cierreEsperado);
    return d ? Math.ceil((d.getTime() - now) / DAY_MS) : null;
  };
  const isOpen = (l: Lead) => l.ganado === "Pendiente" && l.activo;

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
  const byPreventa = useMemo(() => {
    const map = new Map<string, { name: string; open: number; won: number; lost: number; pipeline: number; stale: number }>();
    for (const l of filtered) {
      const name = l.preventa || "Sin asignar";
      const r = map.get(name) ?? { name, open: 0, won: 0, lost: 0, pipeline: 0, stale: 0 };
      if (isOpen(l)) { r.open++; r.pipeline += l.ingresosEsperados; if (daysSince(l) > STALE_DAYS) r.stale++; }
      else if (l.ganado === "Ganado") r.won++;
      else if (l.ganado === "Perdido") r.lost++;
      map.set(name, r);
    }
    return [...map.values()].sort((a, b) => b.open - a.open || b.won - a.won);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);
  const maxOpen = Math.max(1, ...byPreventa.map((r) => r.open));

  /* embudo por etapa de preventa */
  const byEtapa = useMemo(() => {
    const map = new Map<string, { name: string; count: number; open: number; pipeline: number; days: number }>();
    for (const l of filtered) {
      const name = l.etapaPreventa || "Sin etapa";
      const r = map.get(name) ?? { name, count: 0, open: 0, pipeline: 0, days: 0 };
      r.count++;
      if (isOpen(l)) { r.open++; r.pipeline += l.ingresosEsperados; r.days += daysSince(l); }
      map.set(name, r);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);
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
    estancados: { label: `Estancados +${STALE_DAYS} d`, items: [...stats.stale].sort((a, b) => daysSince(b) - daysSince(a)), hint: (l) => `${daysSince(l)} d sin cambios` },
    proximos:   { label: `Cierre ≤ ${SOON_DAYS} d`, items: [...stats.soon].sort((a, b) => (daysToClose(a) ?? 0) - (daysToClose(b) ?? 0)), hint: (l) => `cierra en ${daysToClose(l)} d` },
  };
  const q = queues[queue];

  return (
    <div className="flex-1 overflow-auto p-5 space-y-4 relative">
      {/* filtros */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
        <FilterSelect label="Preventa"    value={fPreventa} onChange={setFPreventa} options={opts.preventa} />
        <FilterSelect label="Línea"       value={fLinea}    onChange={setFLinea}    options={opts.linea} />
        <FilterSelect label="Etapa Prev." value={fEtapa}    onChange={setFEtapa}    options={opts.etapa} />
        <FilterSelect label="Estado"      value={fEstado}   onChange={setFEstado}   options={ESTADO_OPTS}
          headerAction={activeFilters > 0 && (
            <button type="button" onClick={clearFilters} title={`Limpiar filtros (${activeFilters})`} className="text-slate-500 hover:text-rose-400 transition-colors">
              <X size={11} />
            </button>
          )} />
        <button onClick={onReload} disabled={loading} title="Actualizar"
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 border border-white/[0.1] hover:bg-white/[0.05] disabled:opacity-60 transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Actualizar
        </button>
      </div>

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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="En preventa"     value={String(stats.total)} hint={`${stats.open.length} abiertos`} />
            <Kpi label="Pipeline abierto" value={fmtCOP(stats.pipeline)} hint="Ingresos esperados" />
            <Kpi label="Tasa de éxito"   value={stats.winRate === null ? "—" : `${stats.winRate}%`} hint={`${stats.won.length} ganados · ${stats.lost.length} perdidos`} tone="emerald" />
            <Kpi label="Sin preventa"    value={String(stats.sinAsig.length)} hint="Abiertos sin responsable" tone="amber" />
            <Kpi label="Estancados"      value={String(stats.stale.length)} hint={`Más de ${STALE_DAYS} días sin cambios`} tone="rose" />
            <Kpi label="Cierre próximo"  value={String(stats.soon.length)} hint={`En ${SOON_DAYS} días o menos`} tone="amber" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            {/* carga por preventa */}
            <Card title="Carga por preventa" className="xl:col-span-3"
              right={<span className="text-[10px] text-slate-500">Clic para filtrar</span>}>
              {byPreventa.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Sin datos</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="text-left font-semibold pb-2 pr-3">Preventa</th>
                        <th className="text-left font-semibold pb-2 pr-3 w-36">Abiertos</th>
                        <th className="text-right font-semibold pb-2 px-2">Ganados</th>
                        <th className="text-right font-semibold pb-2 px-2">Perdidos</th>
                        <th className="text-right font-semibold pb-2 px-2">Éxito</th>
                        <th className="text-right font-semibold pb-2 px-2">Pipeline</th>
                        <th className="text-right font-semibold pb-2 pl-2">Estancados</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {byPreventa.map((r) => {
                        const rate = pct(r.won, r.won + r.lost);
                        const active = fPreventa === r.name;
                        return (
                          <tr key={r.name}
                            onClick={() => r.name !== "Sin asignar" && setFPreventa(active ? "ALL" : r.name)}
                            className={`transition-colors ${r.name !== "Sin asignar" ? "cursor-pointer hover:bg-white/[0.05]" : ""} ${active ? "bg-white/[0.06]" : ""}`}>
                            <td className={`py-2 pr-3 font-medium truncate max-w-[180px] ${r.name === "Sin asignar" ? "text-amber-400" : "text-slate-200"}`} title={r.name}>{r.name}</td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(r.open / maxOpen) * 100}%` }} />
                                </div>
                                <span className="w-6 text-right tabular-nums text-slate-300">{r.open}</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-emerald-400">{r.won}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-slate-400">{r.lost}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-slate-300">{rate === null ? "—" : `${rate}%`}</td>
                            <td className="py-2 px-2 text-right tabular-nums text-slate-300 whitespace-nowrap">{fmtCOP(r.pipeline)}</td>
                            <td className={`py-2 pl-2 text-right tabular-nums ${r.stale > 0 ? "text-rose-400 font-semibold" : "text-slate-500"}`}>{r.stale}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* embudo por etapa */}
            <Card title="Etapas de preventa" className="xl:col-span-2"
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
    </div>
  );
}
