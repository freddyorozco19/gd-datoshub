"use client";

import { useEffect, useRef, useState, useMemo, useCallback, Fragment, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw, Search, Download, ChevronUp, ChevronDown,
  Users, AlertCircle,
  CalendarCheck2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Eye, X, History,
  ExternalLink, Sparkles, SlidersHorizontal, Calendar,
  BarChart2, Trophy, Activity, Layers,
  Paperclip, FileText, FileImage, File,
} from "lucide-react";
import type { Lead, OdooAttachment } from "@/lib/odoo/types";
import Topbar from "@/components/layout/Topbar";

const ODOO_BASE = "https://grow-data.odoo.com";

/* ── helpers ─────────────────────────────────────────────────────────── */

const COP = (v: number) =>
  v ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v) : "—";

const unique = (arr: string[]) =>
  ["ALL", ...Array.from(new Set(arr.filter(Boolean))).sort()];

const fmtDate = (s: string) => (s ? s.substring(0, 10) : "—");

const fmtFileSize = (bytes: number): string => {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000)     return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
};

function fileTypeIcon(mimetype: string): { icon: typeof File; colors: string } {
  if (mimetype === "application/pdf")
    return { icon: FileText,  colors: "bg-rose-500/10 text-rose-500" };
  if (mimetype.startsWith("image/"))
    return { icon: FileImage, colors: "bg-violet-500/10 text-violet-500" };
  if (mimetype.includes("spreadsheet") || mimetype.includes("excel") || mimetype === "text/csv")
    return { icon: FileText,  colors: "bg-emerald-500/10 text-emerald-400" };
  if (mimetype.includes("word") || mimetype.includes("document") || mimetype.includes("msword"))
    return { icon: FileText,  colors: "bg-blue-500/10 text-blue-400" };
  return { icon: File, colors: "bg-white/[0.06] text-slate-500" };
}

const WON_STYLE: Record<string, string> = {
  Ganado:        "bg-emerald-500/10 text-emerald-400",
  Perdido:       "bg-rose-500/10 text-rose-400",
  "En progreso": "bg-blue-500/10 text-blue-400",
};

const ETAPA_STYLE: Record<string, string> = {
  "Nuevo":               "bg-white/[0.06] text-slate-400",
  "En proceso":          "bg-sky-500/10 text-sky-400",
  "Propuesta enviada":   "bg-violet-500/10 text-violet-400",
  "Negociación":         "bg-amber-500/10 text-amber-400",
  "Ganado":              "bg-emerald-500/10 text-emerald-400",
  "Perdido":             "bg-rose-500/10 text-rose-400",
};

const ETAPA_ORDER = [
  "Nuevo", "En proceso", "Propuesta enviada", "Negociación", "Ganado", "Perdido",
] as const;

const ETAPA_BAR: Record<string, string> = {
  "Nuevo":               "bg-slate-400",
  "En proceso":          "bg-sky-500",
  "Propuesta enviada":   "bg-violet-500",
  "Negociación":         "bg-amber-500",
  "Ganado":              "bg-emerald-500",
  "Perdido":             "bg-rose-400",
};

/* ── alias de visualización para nombres de línea ───────────────────── */
const lineaLabel = (l: string): string => {
  if (l.toUpperCase().startsWith("DATOS Y SISTEMAS")) return "DATOS";
  return l;
};

/* ── paleta de colores para líneas ──────────────────────────────────── */
const LINE_PALETTE = [
  { bar: "bg-blue-500",    badge: "bg-blue-500/10 text-blue-400" },
  { bar: "bg-violet-500",  badge: "bg-violet-500/10 text-violet-400" },
  { bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400" },
  { bar: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-400" },
  { bar: "bg-rose-500",    badge: "bg-rose-500/10 text-rose-400" },
  { bar: "bg-cyan-500",    badge: "bg-cyan-500/10 text-cyan-400" },
  { bar: "bg-orange-500",  badge: "bg-orange-500/10 text-orange-400" },
  { bar: "bg-indigo-500",  badge: "bg-indigo-500/10 text-indigo-400" },
];

/* ── skeleton de tabla ────────────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="flex-1 min-w-0 bg-[#111120] rounded-xl border border-white/[0.07] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/[0.05] bg-[#0e0e1c]">
        <div className="h-3 w-44 bg-white/[0.08] rounded animate-pulse" />
      </div>
      <div className="divide-y divide-white/[0.04]">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3 animate-pulse">
            <div className="h-3 rounded bg-white/[0.08]" style={{ width: `${100 + (i % 4) * 35}px` }} />
            <div className="h-3 w-24 rounded bg-white/[0.06]" />
            <div className="h-3 w-20 rounded bg-white/[0.06]" />
            <div className="h-3 w-16 rounded bg-white/[0.06]" />
            <div className="h-3 w-12 rounded bg-white/[0.06]" />
            <div className="h-3 w-16 rounded bg-white/[0.06] ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── widget: tendencia mensual ──────────────────────────────────────── */
const TREND_RANGES = [
  { label: "3M",  value: 3  },
  { label: "6M",  value: 6  },
  { label: "12M", value: 12 },
  { label: "24M", value: 24 },
  { label: "Todo",value: 0  },
] as const;

function MonthlyTrendWidget({ leads }: { leads: Lead[] }) {
  const [range,   setRange]   = useState<number>(6);
  const [hovered, setHovered] = useState<{ label: string; count: number; ganados: number } | null>(null);

  const months = useMemo(() => {
    const nowGMT5 = new Date();
    nowGMT5.setHours(nowGMT5.getHours() - 5);
    nowGMT5.setDate(1);

    let count: number;
    if (range === 0) {
      if (leads.length === 0) { count = 6; }
      else {
        const earliest = leads.reduce((min, l) => l.fechaCreacion < min ? l.fechaCreacion : min, leads[0].fechaCreacion);
        const start = new Date(earliest.substring(0, 7) + "-01T12:00:00");
        const diff  = (nowGMT5.getFullYear() - start.getFullYear()) * 12 + (nowGMT5.getMonth() - start.getMonth()) + 1;
        count = Math.max(diff, 1);
      }
    } else {
      count = range;
    }

    return Array.from({ length: count }, (_, i) => {
      const d = new Date(nowGMT5);
      d.setMonth(d.getMonth() - (count - 1 - i));
      const key   = d.toISOString().substring(0, 7);
      const label = d.toLocaleDateString("es-CO", { month: "short" });
      const ml = leads.filter((l) => l.fechaCreacion.startsWith(key));
      return {
        key, label,
        count:   ml.length,
        ganados: ml.filter((l) => l.ganado === "Ganado").length,
      };
    });
  }, [leads, range]);

  const maxCount    = Math.max(...months.map((m) => m.count), 1);
  const totalLeads  = months.reduce((s, m) => s + m.count, 0);
  const totalGanados= months.reduce((s, m) => s + m.ganados, 0);
  const BAR_H       = 72;
  const showLegend  = range !== 0 && range <= 12 && hovered === null;

  return (
    <div className="bg-[#111120] rounded-xl border border-white/[0.07] px-5 py-4">
      {/* header */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="p-1.5 rounded-lg bg-indigo-500/10 shrink-0">
          <BarChart2 size={15} className="text-indigo-400" />
        </div>
        <span className="text-sm font-semibold text-slate-200">Tendencia mensual</span>

        {/* selector de rango */}
        <div className="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 ml-1">
          {TREND_RANGES.map(({ label, value }) => (
            <button
              key={label}
              onClick={() => setRange(value)}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
                range === value ? "bg-indigo-500/20 text-indigo-300" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* panel derecho: tooltip de hover O leyenda */}
        <div className="ml-auto flex items-center gap-4 min-h-[22px]">
          {hovered ? (
            <>
              <span className="text-xs font-semibold text-slate-200 capitalize">{hovered.label}</span>
              <span className="text-[11px] text-slate-400">
                <span className="text-slate-200 font-bold">{hovered.count}</span> leads
              </span>
              <span className="text-[11px] text-emerald-400">
                <span className="font-bold">{hovered.ganados}</span> ganados
                {hovered.count > 0 && (
                  <span className="text-slate-500 ml-1">
                    · {Math.round((hovered.ganados / hovered.count) * 100)}%
                  </span>
                )}
              </span>
            </>
          ) : showLegend ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500/30" />
                <span className="text-[10px] text-slate-500">Total</span>
                <span className="text-[10px] font-bold text-slate-300">{totalLeads}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                <span className="text-[10px] text-slate-500">Ganados</span>
                <span className="text-[10px] font-bold text-emerald-400">{totalGanados}</span>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* barras */}
      <div className="overflow-x-auto pb-1">
        <div
          className="flex items-end gap-1"
          style={{ minWidth: months.length > 16 ? months.length * 26 : undefined }}
        >
          {months.map(({ key, label, count, ganados }, i) => {
            const totalPx = Math.max(3, Math.round((count / maxCount) * BAR_H));
            const ganPx   = count > 0 ? Math.round((ganados / count) * totalPx) : 0;
            const year     = key.substring(0, 4);
            const prevYear = i > 0 ? months[i - 1].key.substring(0, 4) : year;
            const yearBreak = year !== prevYear;
            return (
              <Fragment key={key}>
                {/* delimitador de año: línea punteada entre diciembre y enero */}
                {yearBreak && (
                  <div className="shrink-0 flex flex-col items-center gap-1 self-stretch">
                    <div className="border-l border-dashed border-white/[0.14]" style={{ height: BAR_H }} />
                    <span className="text-[9px] font-semibold text-slate-400 leading-none whitespace-nowrap">{year}</span>
                  </div>
                )}
                <div
                  className="flex-1 min-w-[20px] flex flex-col items-center cursor-default"
                  onMouseEnter={() => setHovered({ label, count, ganados })}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="w-full flex items-end" style={{ height: BAR_H }}>
                    <div
                      className="relative w-full rounded-t overflow-hidden bg-indigo-500/20 transition-all duration-300"
                      style={{ height: totalPx }}
                    >
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-indigo-500 transition-all duration-700"
                        style={{ height: ganPx }}
                      />
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── mapa de calor ───────────────────────────────────────────────────── */
function LeadHeatmap({ leads }: { leads: Lead[] }) {
  const { weeks, monthLabels } = useMemo(() => {
    const WEEKS = 13;
    const countByDay: Record<string, number> = {};
    leads.forEach((l) => {
      const day = l.fechaCreacion.substring(0, 10);
      countByDay[day] = (countByDay[day] || 0) + 1;
    });

    const today = new Date();
    today.setHours(today.getHours() - 5);
    const dow = today.getDay();
    const daysToMonday = dow === 0 ? 6 : dow - 1;
    const anchor = new Date(today);
    anchor.setDate(today.getDate() - daysToMonday - (WEEKS - 1) * 7);

    // 1ª pasada: contar por día solo dentro de la ventana visible
    const grid: { date: string; count: number }[][] = [];
    const mlabels: { weekIdx: number; label: string }[] = [];
    let lastMonth = -1;
    let maxCount  = 0;

    for (let w = 0; w < WEEKS; w++) {
      const week: { date: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(anchor);
        dt.setDate(anchor.getDate() + w * 7 + d);
        const dateStr = dt.toISOString().substring(0, 10);
        const count   = countByDay[dateStr] || 0;
        if (count > maxCount) maxCount = count;
        if (d === 0 && dt.getMonth() !== lastMonth) {
          mlabels.push({ weekIdx: w, label: dt.toLocaleDateString("es-CO", { month: "short" }) });
          lastMonth = dt.getMonth();
        }
        week.push({ date: dateStr, count });
      }
      grid.push(week);
    }

    // 2ª pasada: intensidad por cuartiles respecto al máximo visible
    const levelFor = (count: number): number => {
      if (count === 0) return 0;
      const r = count / maxCount;
      if (r <= 0.25) return 1;
      if (r <= 0.5)  return 2;
      if (r <= 0.75) return 3;
      return 4;
    };
    const weeksArr = grid.map((week) =>
      week.map(({ date, count }) => ({ date, count, level: levelFor(count) }))
    );

    return { weeks: weeksArr, monthLabels: mlabels };
  }, [leads]);

  const COLORS = ["bg-white/[0.06]", "bg-emerald-900/60", "bg-emerald-700/60", "bg-emerald-500", "bg-emerald-400"];
  const DAY_LABELS = ["L", "", "X", "", "V", "", "D"];

  return (
    <div className="bg-[#111120] rounded-xl border border-white/[0.07] p-4">
      <div className="mb-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 shrink-0">
            <Activity size={15} className="text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200 uppercase tracking-wide">Actividad de leads</span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[10px] text-slate-400">Menos</span>
          {COLORS.map((c, i) => <div key={i} className={`w-2.5 h-2.5 rounded-sm ${c}`} />)}
          <span className="text-[10px] text-slate-400">Más</span>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {/* etiquetas de mes */}
          <div style={{ display: "flex", gap: 3, paddingLeft: 19 }}>
            {weeks.map((_, wi) => {
              const ml = monthLabels.find((m) => m.weekIdx === wi);
              return (
                <div key={wi} style={{ flex: 1, minWidth: 0, fontSize: 8, color: "#94a3b8", lineHeight: 1, whiteSpace: "nowrap" }}>
                  {ml ? ml.label : ""}
                </div>
              );
            })}
          </div>
          {/* cuadrícula */}
          <div style={{ display: "flex", gap: 3 }}>
            {/* etiquetas de día */}
            <div style={{ display: "flex", flexDirection: "column", gap: 3, width: 16, flexShrink: 0 }}>
              {DAY_LABELS.map((l, i) => (
                <div key={i} style={{ flex: 1, fontSize: 8, color: "#94a3b8", display: "flex", alignItems: "center" }}>{l}</div>
              ))}
            </div>
            {/* columnas de semana */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                {week.map(({ date, count, level }) => (
                  <div
                    key={date}
                    title={`${date}: ${count} lead${count !== 1 ? "s" : ""}`}
                    className={`rounded-sm cursor-default transition-opacity hover:opacity-70 ${COLORS[level]}`}
                    style={{ width: "100%", aspectRatio: "1 / 1" }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── modal: tabla de leads del día ──────────────────────────────────── */
interface DayLeadsModalProps { leads: Lead[]; date?: string; title?: string; heading?: string; onClose: () => void; }

function DayLeadsModal({ leads, date, title, heading, onClose }: DayLeadsModalProps) {
  const dateLabel = date
    ? new Date(date + "T12:00:00").toLocaleDateString("es-CO", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "";
  const headerTitle = title ?? dateLabel;

  const [mLinea,     setMLinea]     = useState("ALL");
  const [mComercial, setMComercial] = useState("ALL");
  const [mEstado,    setMEstado]    = useState("ALL");
  const [detailLead, setDetailLead] = useState<Lead | null>(null);

  const mOpts = useMemo(() => ({
    linea:     unique(leads.map((l) => l.linea)),
    comercial: unique(leads.map((l) => l.comercial)),
    estado:    unique(leads.map((l) => l.ganado)),
  }), [leads]);

  const mFiltered = useMemo(() => {
    let data = [...leads];
    if (mLinea     !== "ALL") data = data.filter((l) => l.linea     === mLinea);
    if (mComercial !== "ALL") data = data.filter((l) => l.comercial === mComercial);
    if (mEstado    !== "ALL") data = data.filter((l) => l.ganado    === mEstado);
    return data;
  }, [leads, mLinea, mComercial, mEstado]);

  const anyActive = mLinea !== "ALL" || mComercial !== "ALL" || mEstado !== "ALL";

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !detailLead) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, detailLead]);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111120] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-100 capitalize">{headerTitle}</h2>
              {heading && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">{heading}</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {mFiltered.length}{mFiltered.length !== leads.length && ` de ${leads.length}`}{" "}
              {leads.length === 1 ? "lead registrado" : "leads registrados"}
              {heading && " en esta línea"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 border-b border-white/[0.05] bg-[#0e0e1c]">
          {([
            { label: "Línea",     val: mLinea,     set: setMLinea,     opts: mOpts.linea },
            { label: "Comercial", val: mComercial, set: setMComercial, opts: mOpts.comercial },
            { label: "Estado",    val: mEstado,    set: setMEstado,    opts: mOpts.estado },
          ] as { label: string; val: string; set: (v: string) => void; opts: string[] }[]).map(({ label, val, set, opts }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{label}:</span>
              <select value={val} onChange={(e) => set(e.target.value)}
                className="text-xs border border-white/[0.08] rounded-lg px-2 py-1.5 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-300">
                {opts.map((o) => <option key={o} value={o}>{o === "ALL" ? "Todos" : o}</option>)}
              </select>
            </div>
          ))}
          {anyActive && (
            <button onClick={() => { setMLinea("ALL"); setMComercial("ALL"); setMEstado("ALL"); }}
              className="text-xs text-blue-400 hover:underline ml-auto">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="overflow-auto flex-1">
          {mFiltered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Sin leads con los filtros seleccionados</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#0e0e1c] border-b border-white/[0.07]">
                <tr>
                  {["Nombre","Cliente","Comercial","Línea","Etapa","Tipo Oportunidad","Preventa","Ingresos Esp.","Estado"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {mFiltered.map((lead) => (
                  <tr key={lead.id} onClick={() => setDetailLead(lead)}
                    className="hover:bg-blue-500/10/40 transition-colors cursor-pointer group">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-100 max-w-[180px] truncate group-hover:text-blue-400 transition-colors" title={lead.nombre}>{lead.nombre}</p>
                      {lead.correo && <p className="text-slate-400 truncate max-w-[180px] text-[10px]">{lead.correo}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[140px]"><span className="truncate block" title={lead.cliente}>{lead.cliente || "—"}</span></td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.comercial || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lead.linea ? <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-medium">{lead.linea}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${ETAPA_STYLE[lead.etapa] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.etapa || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.tipoOportunidad || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.preventa || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-200 whitespace-nowrap">{lead.ingresosEsperados ? COP(lead.ingresosEsperados) : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${WON_STYLE[lead.ganado] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.ganado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* detalle del lead — mismo popup que "Últimas asignadas" */}
      {detailLead && <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} />}
    </div>
  );
  return createPortal(modal, document.body);
}

/* ── modal: detalle completo de un lead ─────────────────────────────── */
interface LeadDetailModalProps { lead: Lead; onClose: () => void; }

function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const [attachments,        setAttachments]        = useState<OdooAttachment[] | null>(null);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Carga adjuntos al abrir el modal si el lead tiene alguno
  useEffect(() => {
    if (!lead.adjuntos) return;
    setLoadingAttachments(true);
    fetch(`/api/odoo/leads/${lead.id}/attachments`)
      .then((r) => r.json())
      .then((d) => setAttachments(d.attachments ?? []))
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttachments(false));
  }, [lead.id, lead.adjuntos]);

  const odooUrl = `${ODOO_BASE}/web#model=crm.lead&id=${lead.id}&view_type=form`;

  const Field = ({ label, value }: { label: string; value: ReactNode }) => (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-xs text-slate-300">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111120] rounded-2xl shadow-2xl shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">ID {lead.id}</p>
            <h2 className="font-semibold text-slate-100 text-base leading-snug" title={lead.nombre}>{lead.nombre}</h2>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {lead.linea && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">{lead.linea}</span>}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${WON_STYLE[lead.ganado] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.ganado}</span>
              {lead.etapa && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ETAPA_STYLE[lead.etapa] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.etapa}</span>}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lead.activo ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-slate-500"}`}>
                {lead.activo ? "Activo" : "Inactivo"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* 6. Link directo a ODOO */}
            <a
              href={odooUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver en ODOO CRM"
              className="p-2 rounded-lg text-slate-400 hover:bg-orange-500/10 hover:text-orange-500 transition-colors"
            >
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-300 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Cliente & Contacto</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Cliente"          value={lead.cliente} />
              <Field label="Comercial"        value={lead.comercial} />
              <Field label="Correo"           value={lead.correo} />
              <Field label="Teléfono"         value={lead.telefono} />
              <Field label="Equipo de Ventas" value={lead.equipoVentas} />
              <Field label="Preventa"         value={lead.preventa} />
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Oportunidad</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Tipo de Oportunidad" value={lead.tipoOportunidad} />
              <Field label="Línea"               value={lead.linea} />
              <Field label="Etapa Preventa"      value={lead.etapaPreventa} />
              <Field label="Fabricante"          value={lead.fabricante} />
              <Field label="Tipo Cliente"        value={lead.tipoCliente} />
              <Field label="Tipo Venta"          value={lead.tipoVenta} />
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Financiero</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Ingresos Esperados" value={lead.ingresosEsperados ? COP(lead.ingresosEsperados) : null} />
              <Field label="Consultoría COP"    value={lead.consultoriaCOP    ? COP(lead.consultoriaCOP)    : null} />
              <Field label="Datos COP"          value={lead.datosCOP          ? COP(lead.datosCOP)          : null} />
              <Field label="TI COP"             value={lead.tiCOP             ? COP(lead.tiCOP)             : null} />
            </div>
          </section>

          {(lead.alcance || lead.objeto) && (
            <section>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Alcance & Objeto</h3>
              <div className="space-y-3">
                {lead.alcance && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Alcance</p><p className="text-xs text-slate-200 leading-relaxed">{lead.alcance}</p></div>}
                {lead.objeto  && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Objeto</p><p className="text-xs text-slate-200 leading-relaxed">{lead.objeto}</p></div>}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Fechas</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Fecha Creación"        value={lead.fechaCreacion       ? lead.fechaCreacion.substring(0, 10)  : null} />
              <Field label="Cierre Esperado"       value={lead.cierreEsperado      || null} />
              <Field label="Fecha Efectiva Cierre" value={lead.fechaEfectivaCierre || null} />
              <Field label="Fecha Cierre"          value={lead.fechaCierre         ? lead.fechaCierre.substring(0, 10)    : null} />
              <Field label="Última Modificación"   value={lead.ultimaModificacion  || null} />
            </div>
          </section>

          {/* ── Adjuntos ── */}
          {lead.adjuntos > 0 && (
            <section>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05] flex items-center gap-1.5">
                <Paperclip size={10} />
                Adjuntos · {lead.adjuntos}
              </h3>

              {loadingAttachments ? (
                <div className="space-y-2">
                  {Array.from({ length: lead.adjuntos }).map((_, i) => (
                    <div key={i} className="h-12 bg-white/[0.06] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : attachments && attachments.length > 0 ? (
                <div className="space-y-2">
                  {attachments.map((att) => {
                    const { icon: Icon, colors } = fileTypeIcon(att.mimetype);
                    return (
                      <a
                        key={att.id}
                        href={`/api/odoo/attachment/${att.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/[0.05] hover:border-blue-500/30 hover:bg-blue-500/10/40 transition-colors group"
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${colors}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                            {att.name}
                          </p>
                          {att.file_size > 0 && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{fmtFileSize(att.file_size)}</p>
                          )}
                        </div>
                        <ExternalLink size={12} className="text-slate-300 group-hover:text-blue-400 shrink-0 transition-colors" />
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-3">
                  No se pudieron cargar los adjuntos
                </p>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

/* ── widget: últimas 5 leads asignadas ──────────────────────────────── */
function RecentLeadsWidget({ leads }: { leads: Lead[] }) {
  const [lineaFilter, setLineaFilter] = useState<string[]>([]);
  const initialized = useRef(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const availableLineas = useMemo(
    () => Array.from(new Set(leads.map((l) => l.linea).filter(Boolean))).sort(),
    [leads]
  );

  useEffect(() => {
    if (initialized.current || availableLineas.length === 0) return;
    initialized.current = true;
    const datos = availableLineas.find((l) => l.toUpperCase().startsWith("DATOS Y SISTEMAS"));
    setLineaFilter(datos ? [datos] : [availableLineas[0]]);
  }, [availableLineas]);

  const lineaColor = useMemo(() => {
    const map: Record<string, typeof LINE_PALETTE[0]> = {};
    availableLineas.forEach((l, i) => { map[l] = LINE_PALETTE[i % LINE_PALETTE.length]; });
    return map;
  }, [availableLineas]);

  function toggleLinea(linea: string) {
    setLineaFilter((prev) => {
      if (prev.includes(linea)) {
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== linea);
      }
      return [...prev, linea];
    });
  }

  const recent = useMemo(() =>
    [...leads]
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
      .filter((l) => lineaFilter.includes(l.linea))
      .slice(0, 5),
    [leads, lineaFilter]
  );

  return (
    <div className="bg-[#111120] rounded-xl border border-white/[0.07] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-violet-500/10 shrink-0"><History size={15} className="text-violet-400" /></div>
        <span className="text-sm font-semibold text-slate-200 flex-1">Últimas asignadas</span>
      </div>

      {availableLineas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {availableLineas.map((linea) => {
            const palette = lineaColor[linea] ?? LINE_PALETTE[0];
            const active = lineaFilter.includes(linea);
            return (
              <button key={linea} type="button" title={linea} onClick={() => toggleLinea(linea)}
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition-colors truncate max-w-[96px] ${
                  active ? `${palette.badge} ring-1 ring-current` : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]"
                }`}>
                {lineaLabel(linea)}
              </button>
            );
          })}
        </div>
      )}

      {recent.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin leads en las líneas seleccionadas</p>
      ) : (
        <div className="space-y-1.5">
          {recent.map((lead, i) => {
            const palette = lineaColor[lead.linea] ?? LINE_PALETTE[0];
            const fecha = lead.fechaCreacion ? lead.fechaCreacion.substring(0, 10) : "";
            const hora  = lead.fechaCreacion && lead.fechaCreacion.length >= 16 ? lead.fechaCreacion.substring(11, 16) : "";
            return (
              <button key={lead.id} type="button" onClick={() => setSelectedLead(lead)}
                className="w-full flex gap-2 items-start text-left rounded-lg px-2 py-2 hover:bg-violet-500/10 hover:border-violet-500/30 border border-transparent transition-colors group">
                <span className="text-[10px] font-bold text-slate-300 mt-0.5 w-3.5 shrink-0 text-right group-hover:text-violet-400 transition-colors">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-100 truncate leading-snug group-hover:text-violet-400 transition-colors" title={lead.nombre}>{lead.nombre}</p>
                  {lead.cliente && <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{lead.cliente}</p>}
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {lead.linea && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-tight ${palette.badge}`}>{lead.linea}</span>}
                    {fecha && <span className="text-[9px] text-slate-400 leading-tight whitespace-nowrap">{fecha}{hora && <> · {hora}</>}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  );
}

/* ── widget: ranking de comerciales ────────────────────────────────── */
function ComercialRankingWidget({ leads }: { leads: Lead[] }) {
  const [sortBy, setSortBy] = useState<"leads" | "ganados" | "ingresos">("leads");
  const [selectedComercial, setSelectedComercial] = useState<string | null>(null);

  const comercialLeads = useMemo(
    () => selectedComercial
      ? leads.filter((l) => (l.comercial || "Sin asignar") === selectedComercial)
      : [],
    [leads, selectedComercial]
  );

  const ranking = useMemo(() => {
    const map: Record<string, { leads: number; ganados: number; ingresos: number }> = {};
    leads.forEach((l) => {
      const k = l.comercial || "Sin asignar";
      if (!map[k]) map[k] = { leads: 0, ganados: 0, ingresos: 0 };
      map[k].leads++;
      if (l.ganado === "Ganado") map[k].ganados++;
      map[k].ingresos += l.ingresosEsperados || 0;
    });
    return Object.entries(map)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, 7);
  }, [leads, sortBy]);

  const maxVal = Math.max(...ranking.map((r) => r[sortBy]), 1);

  function fmt(r: typeof ranking[0]) {
    if (sortBy === "ingresos")
      return r.ingresos >= 1_000_000
        ? `$${(r.ingresos / 1_000_000).toFixed(1)}M`
        : `$${(r.ingresos / 1_000).toFixed(0)}K`;
    return String(r[sortBy]);
  }

  return (
    <div className="bg-[#111120] rounded-xl border border-white/[0.07] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0">
          <Trophy size={15} className="text-amber-400" />
        </div>
        <span className="text-sm font-semibold text-slate-200 flex-1">Ranking</span>
      </div>

      {/* tabs de ordenamiento */}
      <div className="flex gap-0.5 mb-3 bg-white/[0.06] rounded-lg p-0.5">
        {(["leads", "ganados", "ingresos"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`flex-1 text-[10px] font-semibold py-1 rounded-md transition-colors capitalize ${
              sortBy === key ? "bg-white/[0.10] text-amber-400 shadow-sm" : "text-slate-400 hover:text-slate-300"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {ranking.map((r, i) => (
          <button
            key={r.name}
            type="button"
            onClick={() => setSelectedComercial(r.name)}
            title={`Ver leads de ${r.name}`}
            className="w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-amber-500/10 transition-colors group focus:outline-none"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-4 text-center shrink-0 text-[10px] font-bold text-slate-300">{i + 1}</span>
                <span className="text-xs text-slate-200 truncate leading-none group-hover:text-amber-400 transition-colors" title={r.name}>{r.name}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 shrink-0 ml-2">{fmt(r)}</span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden ml-5">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((r[sortBy] / maxVal) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>

      {selectedComercial && (
        <DayLeadsModal
          leads={comercialLeads}
          title={selectedComercial}
          onClose={() => setSelectedComercial(null)}
        />
      )}
    </div>
  );
}

/* ── widget: funnel de ventas ────────────────────────────────────────── */
interface FunnelProps {
  leads:         Lead[];
  activeEtapa:   string;
  onEtapaClick:  (etapa: string) => void;
}

function SalesFunnelWidget({ leads, activeEtapa, onEtapaClick }: FunnelProps) {
  const [lineaFilter, setLineaFilter] = useState("ALL");

  const availableLineas = useMemo(
    () => Array.from(new Set(leads.map((l) => l.linea).filter(Boolean))).sort(),
    [leads]
  );

  const baseLeads = useMemo(
    () => lineaFilter === "ALL" ? leads : leads.filter((l) => l.linea === lineaFilter),
    [leads, lineaFilter]
  );

  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {};
    baseLeads.forEach((l) => { if (l.etapa) counts[l.etapa] = (counts[l.etapa] || 0) + 1; });

    // primero etapas conocidas en orden, luego cualquier otra
    const ordered = (ETAPA_ORDER as readonly string[])
      .filter((e) => counts[e])
      .map((etapa) => ({ etapa, count: counts[etapa] }));
    Object.entries(counts)
      .filter(([e]) => !(ETAPA_ORDER as readonly string[]).includes(e))
      .forEach(([etapa, count]) => ordered.splice(ordered.length - 1, 0, { etapa, count }));
    return ordered;
  }, [baseLeads]);

  // etapas de pipeline (excluye Perdido para la tasa de conversión)
  const PIPELINE_SET = new Set(["Nuevo", "En proceso", "Propuesta enviada", "Negociación", "Ganado"]);
  const max = Math.max(...funnelData.map((e) => e.count), 1);

  return (
    <div className="bg-[#111120] rounded-xl border border-white/[0.07] px-5 py-4">
      {/* header */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Layers size={15} className="text-violet-400" />
          </div>
          <span className="text-sm font-semibold text-slate-200">Pipeline de ventas</span>
        </div>
        <div className="w-px h-4 bg-white/[0.08] shrink-0" />
        {/* pills de línea */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setLineaFilter("ALL")}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
              lineaFilter === "ALL"
                ? "bg-violet-500/10 text-violet-400 ring-1 ring-current"
                : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]"
            }`}
          >
            Todas
          </button>
          {availableLineas.map((linea) => (
            <button
              key={linea}
              title={linea}
              onClick={() => setLineaFilter(lineaFilter === linea ? "ALL" : linea)}
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors truncate max-w-[110px] ${
                lineaFilter === linea
                  ? "bg-violet-500/10 text-violet-400 ring-1 ring-current"
                  : "bg-white/[0.06] text-slate-400 hover:bg-white/[0.08]"
              }`}
            >
              {lineaLabel(linea)}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-slate-400 hidden sm:block">
          Haz click en una etapa para filtrar la tabla
        </span>
      </div>

      {funnelData.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">Sin datos para mostrar</p>
      ) : (
        <div className="space-y-1">
          {funnelData.map(({ etapa, count }, i) => {
            const pct      = Math.max(4, Math.round((count / max) * 100));
            const barColor = ETAPA_BAR[etapa] ?? "bg-blue-400";
            const isActive = activeEtapa === etapa;

            // tasa de conversión respecto a la anterior etapa del pipeline
            const prevItem = PIPELINE_SET.has(etapa) && i > 0
              ? funnelData.slice(0, i).filter((d) => PIPELINE_SET.has(d.etapa)).at(-1)
              : null;
            const convRate = prevItem && prevItem.count > 0
              ? Math.round((count / prevItem.count) * 100)
              : null;

            // separador visual antes de "Perdido"
            const showSeparator = etapa === "Perdido" && funnelData.some((d) => PIPELINE_SET.has(d.etapa));

            return (
              <div key={etapa}>
                {showSeparator && <div className="border-t border-dashed border-white/[0.07] my-3" />}
                {convRate !== null && (
                  <div className="flex items-center gap-2 mb-1 pl-[148px]">
                    <div className="w-px h-2.5 bg-white/[0.08]" />
                    <span className="text-[9px] text-slate-400">{convRate}% pasan a la siguiente etapa</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onEtapaClick(isActive ? "ALL" : etapa)}
                  className={`w-full flex items-center gap-3 rounded-lg py-0.5 transition-all group ${
                    isActive ? "ring-2 ring-violet-400 ring-offset-1 rounded-lg" : ""
                  }`}
                >
                  {/* label etapa */}
                  <span
                    className="text-xs text-slate-500 w-36 shrink-0 text-right pr-1 truncate leading-snug"
                    title={etapa}
                  >
                    {etapa}
                  </span>
                  {/* barra */}
                  <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden">
                    <div
                      className={`h-full rounded-lg flex items-center justify-end pr-2.5 transition-all duration-500 group-hover:opacity-80 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    >
                      {count > 3 && (
                        <span className="text-[10px] font-bold text-white">{count}</span>
                      )}
                    </div>
                  </div>
                  {/* número */}
                  <span className="text-xs font-bold text-slate-200 w-7 text-right shrink-0">{count}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── widget: Leads por día ───────────────────────────────────────────── */
function TodayLeadsWidget({ leads }: { leads: Lead[] }) {
  function todayGMT5() {
    const d = new Date(); d.setHours(d.getHours() - 5);
    return d.toISOString().substring(0, 10);
  }

  const [selectedDate, setSelectedDate] = useState<string>(todayGMT5);
  const [modal, setModal] = useState<{ leads: Lead[]; heading?: string } | null>(null);
  const isToday = selectedDate === todayGMT5();

  function shiftDay(delta: number) {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + delta);
    const next = d.toISOString().substring(0, 10);
    if (next <= todayGMT5()) setSelectedDate(next);
  }

  const dayLeads = leads.filter((l) => l.fechaCreacion.startsWith(selectedDate));
  const byLinea  = dayLeads.reduce<Record<string, number>>((acc, l) => {
    const k = l.linea || "Sin línea"; acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});
  const sorted = Object.entries(byLinea).sort((a, b) => b[1] - a[1]);
  const max    = Math.max(...sorted.map(([, v]) => v), 1);
  const fmtLabel = new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="w-56 shrink-0 flex flex-col gap-2">
      <LeadHeatmap leads={leads} />
      <div className="bg-[#111120] rounded-xl border border-white/[0.07] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-blue-500/10 shrink-0"><CalendarCheck2 size={15} className="text-blue-400" /></div>
          <span className="text-sm font-semibold text-slate-200 flex-1">Leads por día</span>
          <button onClick={() => setModal({ leads: dayLeads })} disabled={dayLeads.length === 0} title="Ver tabla de leads"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-blue-400 disabled:opacity-30 transition-colors">
            <Eye size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1 mb-1">
          <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors shrink-0"><ChevronLeft size={14} /></button>
          <input type="date" value={selectedDate} max={todayGMT5()}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="flex-1 min-w-0 text-xs border border-white/[0.07] rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[#111120]" />
          <button onClick={() => shiftDay(1)} disabled={isToday}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-30 transition-colors shrink-0"><ChevronRight size={14} /></button>
        </div>

        <p className="text-xs text-slate-400 capitalize mb-3">{fmtLabel}</p>

        <div className="flex items-end gap-1.5 mb-4">
          <span className="text-4xl font-bold text-slate-100 leading-none">{dayLeads.length}</span>
          <span className="text-xs text-slate-400 mb-1">leads</span>
          {isToday && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-400">hoy</span>}
        </div>

        {sorted.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Sin leads en esta fecha</p>
        ) : (
          <div className="space-y-3">
            {sorted.map(([linea, count], i) => {
              const palette = LINE_PALETTE[i % LINE_PALETTE.length];
              const pct = Math.round((count / max) * 100);
              return (
                <button
                  key={linea}
                  onClick={() => setModal({ leads: dayLeads.filter((l) => (l.linea || "Sin línea") === linea), heading: linea })}
                  title={`Ver los ${count} lead(s) de ${linea}`}
                  className="w-full text-left group cursor-pointer focus:outline-none"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 group-hover:text-blue-400 truncate max-w-[130px] transition-colors" title={linea}>{linea}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${palette.badge}`}>{count}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden ring-blue-300 group-hover:ring-2 transition-all">
                    <div className={`h-full ${palette.bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <RecentLeadsWidget leads={leads} />
      <ComercialRankingWidget leads={leads} />

      <p className="text-xs text-slate-400 text-center leading-relaxed px-1">Por fecha de creación · todos los registros</p>

      {modal && <DayLeadsModal leads={modal.leads} date={selectedDate} heading={modal.heading} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ── tipos locales ───────────────────────────────────────────────────── */
type SortKey = keyof Lead;
type SortDir = "asc" | "desc";
const PAGE_SIZE = 20;

interface Filters {
  comercial:       string;
  linea:           string;
  tipoOportunidad: string;
  equipoVentas:    string;
  preventa:        string;
  activo:          string;
  etapa:           string;  // funnel click
  dateFrom:        string;
  dateTo:          string;
}

/* ── componente principal ────────────────────────────────────────────── */
export default function LeadsView() {
  const [leads,     setLeads]     = useState<Lead[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // 1. detalle desde tabla principal
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // 7. leads nuevos desde último sync
  const [newLeadIds,    setNewLeadIds]    = useState<Set<number>>(new Set());
  const prevLeadIdsRef = useRef<Set<number>>(new Set());
  const isFirstLoad    = useRef(true);

  const [search,  setSearch]  = useState("");
  const [filters, setFilters] = useState<Filters>({
    comercial: "ALL", linea: "ALL", tipoOportunidad: "ALL",
    equipoVentas: "ALL", preventa: "ALL", activo: "ALL",
    etapa: "ALL", dateFrom: "", dateTo: "",
  });
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "ultimaModificacion", dir: "desc" });
  const [currentPage, setCurrentPage] = useState(1);

  /* fetch */
  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/odoo/leads");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error desconocido");
      const incoming: Lead[] = data.leads ?? [];

      if (!isFirstLoad.current) {
        const newIds = new Set(
          incoming.filter((l) => !prevLeadIdsRef.current.has(l.id)).map((l) => l.id)
        );
        setNewLeadIds(newIds);
      } else {
        isFirstLoad.current = false;
      }

      prevLeadIdsRef.current = new Set(incoming.map((l) => l.id));
      setLeads(incoming);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadLeads(); }, []);
  useEffect(() => { setCurrentPage(1); }, [filters, search, sort]);

  /* opciones de filtros */
  const opts = useMemo(() => ({
    comercial:       unique(leads.map((l) => l.comercial)),
    linea:           unique(leads.map((l) => l.linea)),
    tipoOportunidad: unique(leads.map((l) => l.tipoOportunidad)),
    equipoVentas:    unique(leads.map((l) => l.equipoVentas)),
    preventa:        unique(leads.map((l) => l.preventa)),
    activo:          ["ALL", "true", "false"],
  }), [leads]);

  /* datos filtrados */
  const filtered = useMemo(() => {
    let data = [...leads];
    if (filters.comercial       !== "ALL") data = data.filter((l) => l.comercial       === filters.comercial);
    if (filters.linea           !== "ALL") data = data.filter((l) => l.linea           === filters.linea);
    if (filters.tipoOportunidad !== "ALL") data = data.filter((l) => l.tipoOportunidad === filters.tipoOportunidad);
    if (filters.equipoVentas    !== "ALL") data = data.filter((l) => l.equipoVentas    === filters.equipoVentas);
    if (filters.preventa        !== "ALL") data = data.filter((l) => l.preventa        === filters.preventa);
    if (filters.activo          !== "ALL") data = data.filter((l) => String(l.activo)  === filters.activo);
    if (filters.etapa           !== "ALL") data = data.filter((l) => l.etapa           === filters.etapa);
    // 2. rango de fechas
    if (filters.dateFrom) data = data.filter((l) => l.fechaCreacion >= filters.dateFrom);
    if (filters.dateTo)   data = data.filter((l) => l.fechaCreacion.substring(0, 10) <= filters.dateTo);

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter((l) =>
        l.nombre.toLowerCase().includes(q) ||
        l.cliente.toLowerCase().includes(q) ||
        l.comercial.toLowerCase().includes(q) ||
        l.etapa.toLowerCase().includes(q)
      );
    }

    data.sort((a, b) => {
      const av = a[sort.key] ?? "", bv = b[sort.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [leads, filters, search, sort]);

  /* paginación */
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);
  const goTo = useCallback((p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.comercial       !== "ALL") c++;
    if (filters.linea           !== "ALL") c++;
    if (filters.tipoOportunidad !== "ALL") c++;
    if (filters.equipoVentas    !== "ALL") c++;
    if (filters.preventa        !== "ALL") c++;
    if (filters.activo          !== "ALL") c++;
    if (filters.etapa           !== "ALL") c++;
    if (filters.dateFrom)                  c++;
    if (filters.dateTo)                    c++;
    if (search.trim())                     c++;
    return c;
  }, [filters, search]);

  function clearFilters() {
    setFilters({
      comercial: "ALL", linea: "ALL", tipoOportunidad: "ALL",
      equipoVentas: "ALL", preventa: "ALL", activo: "ALL",
      etapa: "ALL", dateFrom: "", dateTo: "",
    });
    setSearch("");
  }

  function toggleSort(key: SortKey) {
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  function exportCSV() {
    const cols: (keyof Lead)[] = ["id","activo","nombre","correo","telefono","cliente","comercial","linea","etapa","equipoVentas","tipoOportunidad","preventa","ingresosEsperados","ganado","ultimaModificacion"];
    const header = cols.join(";");
    const rows   = filtered.map((l) => cols.map((c) => `"${String(l[c]).replace(/"/g, '""')}"`).join(";"));
    const csv    = [header, ...rows].join("\n");
    const blob   = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href = url; a.download = `leads_${new Date().toISOString().substring(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sort.key === col
      ? sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
      : <ChevronDown size={13} className="opacity-20" />;

  const Select = ({ label, field, options }: { label: string; field: keyof Filters; options: string[] }) => (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-xs font-medium text-slate-500">{label}</label>
      <select value={filters[field] as string}
        onChange={(e) => setFilters((f) => ({ ...f, [field]: e.target.value }))}
        className="text-xs border border-white/[0.08] rounded-lg px-2 py-1.5 bg-[#111120] focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-200">
        {options.map((o) => (
          <option key={o} value={o}>{o === "ALL" ? "Todos" : o === "true" ? "Activo" : o === "false" ? "Inactivo" : o}</option>
        ))}
      </select>
    </div>
  );

  const newCount = newLeadIds.size;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Leads" subtitle="Oportunidades sincronizadas desde ODOO CRM" />

      <div className="flex-1 overflow-auto p-5 space-y-4">

        {/* ── tendencia mensual ── */}
        {leads.length > 0 && <MonthlyTrendWidget leads={leads} />}

        {/* ── barra de filtros ── */}
        <div className="bg-[#111120] rounded-xl border border-white/[0.07] overflow-hidden">

          {/* cabecera de filtros */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#0e0e1c] border-b border-white/[0.07]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 leading-none">
                  {activeFilterCount}
                </span>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-500 transition-colors"
              >
                <X size={11} /> Limpiar todo
              </button>
            )}
          </div>

          {/* fila 1: dropdowns en grid de 6 columnas */}
          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 border-b border-white/[0.05]">
            <Select label="Comercial"     field="comercial"        options={opts.comercial} />
            <Select label="Línea"         field="linea"            options={opts.linea} />
            <Select label="Oportunidad"   field="tipoOportunidad"  options={opts.tipoOportunidad} />
            <Select label="Equipo Ventas" field="equipoVentas"     options={opts.equipoVentas} />
            <Select label="Preventa"      field="preventa"         options={opts.preventa} />
            <Select label="Activo"        field="activo"           options={opts.activo} />
          </div>

          {/* fila 2: rango de fechas · búsqueda · acciones */}
          <div className="px-4 py-3 flex flex-wrap items-end gap-3">

            {/* rango de fechas agrupado */}
            <div className="flex items-end gap-2">
              <Calendar size={14} className="text-slate-400 mb-2 shrink-0" />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Desde</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  className="text-xs border border-white/[0.08] rounded-lg px-2 py-1.5 bg-[#111120] focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-200 w-36"
                />
              </div>
              <span className="text-slate-300 mb-2 text-sm leading-none">→</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="text-xs border border-white/[0.08] rounded-lg px-2 py-1.5 bg-[#111120] focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-200 w-36"
                />
              </div>
            </div>

            <div className="flex-1" />

            {/* búsqueda */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Buscar</label>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, cliente…"
                  className="pl-8 pr-3 py-1.5 text-xs border border-white/[0.08] rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* botones de acción */}
            <div className="flex items-end gap-2">
              <button
                onClick={loadLeads}
                disabled={loading}
                title="Sincronizar ODOO"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs text-slate-600 hover:bg-[#0e0e1c] disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                {loading ? "Cargando…" : "Sincronizar"}
              </button>
              <button
                onClick={exportCSV}
                disabled={!filtered.length}
                title="Exportar CSV"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-40 transition-colors"
              >
                <Download size={13} />
                Exportar
              </button>
            </div>
          </div>
        </div>

        {/* ── funnel de ventas ── */}
        {leads.length > 0 && (
          <SalesFunnelWidget
            leads={leads}
            activeEtapa={filters.etapa}
            onEtapaClick={(etapa) => setFilters((f) => ({ ...f, etapa }))}
          />
        )}

        {/* ── error ── */}
        {error && (
          <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-sm text-rose-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error al conectar con ODOO</p>
              <p className="text-xs mt-0.5 opacity-80">{error}</p>
            </div>
          </div>
        )}

        {/* 9. skeleton primer carga */}
        {loading && !leads.length && (
          <div className="flex items-start gap-4">
            <TableSkeleton />
            <div className="w-56 shrink-0 space-y-2">
              {[80, 120].map((h) => (
                <div key={h} className="bg-[#111120] rounded-xl border border-white/[0.07] p-4 animate-pulse" style={{ height: h }}>
                  <div className="h-3 w-28 bg-white/[0.08] rounded mb-3" />
                  <div className="space-y-2">
                    <div className="h-2 bg-white/[0.06] rounded w-full" />
                    <div className="h-2 bg-white/[0.06] rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <p className="text-sm">Sin resultados. Haz clic en Sincronizar.</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="flex items-start gap-4">

            {/* ── tabla ── */}
            <div className="flex-1 min-w-0 bg-[#111120] rounded-xl border border-white/[0.07] overflow-hidden">
              {/* info bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05] bg-[#0e0e1c]">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {filtered.length} de {leads.length} leads
                    {lastFetch && ` · actualizado ${lastFetch.toLocaleTimeString("es-CO")}`}
                  </span>
                  {/* 7. badge nuevos leads */}
                  {newCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      <Sparkles size={10} />
                      {newCount} nuevo{newCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {loading && <RefreshCw size={13} className="animate-spin text-blue-500" />}
              </div>

              {/* tabla */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1200px]">
                  <thead>
                    <tr className="bg-[#0e0e1c] border-b border-white/[0.07]">
                      {(
                        [
                          ["nombre",             "Nombre"],
                          ["cliente",            "Cliente"],
                          ["comercial",          "Comercial"],
                          ["linea",              "Línea"],
                          ["etapa",              "Etapa"],
                          ["preventa",           "Preventa"],
                          ["fechaCreacion",      "Fecha Creación"],
                          ["ingresosEsperados",  "Ingresos Esp."],
                          ["cierreEsperado",     "Cierre Esp."],
                          ["ganado",             "Estado"],
                          ["activo",             "Activo"],
                          ["ultimaModificacion", "Actualizado"],
                        ] as [SortKey, string][]
                      ).map(([key, label], idx) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className={`text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-200 select-none whitespace-nowrap
                            ${idx === 0 ? "sticky left-0 z-20 bg-[#0e0e1c] shadow-[1px_0_0_0_rgba(255,255,255,0.07)]" : ""}`}
                        >
                          <span className="flex items-center gap-1">{label}<SortIcon col={key} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-4 py-12 text-center text-slate-400 text-sm">
                          Sin leads con los filtros aplicados
                        </td>
                      </tr>
                    ) : paginated.map((lead) => {
                      const isNew = newLeadIds.has(lead.id);
                      return (
                        // 1. fila clickable → LeadDetailModal
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className={`transition-colors cursor-pointer group ${isNew ? "bg-emerald-500/10/40 hover:bg-emerald-100/50" : "hover:bg-blue-500/10/50"}`}
                        >
                          {/* 3. columna Nombre sticky */}
                          <td className={`px-3 py-2.5 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] ${
                            isNew ? "bg-emerald-500/10/40 group-hover:bg-emerald-100/50" : "bg-[#111120] group-hover:bg-blue-500/10/50"
                          }`}>
                            <div className="flex items-start gap-1.5">
                              {/* 7. badge NEW */}
                              {isNew && (
                                <span className="mt-0.5 shrink-0 text-[8px] font-bold px-1 py-px rounded bg-emerald-500 text-white uppercase leading-tight">
                                  NEW
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-slate-100 max-w-[200px] truncate" title={lead.nombre}>{lead.nombre}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {lead.correo && <p className="text-slate-400 truncate max-w-[170px] text-[10px]">{lead.correo}</p>}
                                  {lead.adjuntos > 0 && (
                                    <span className="flex items-center gap-0.5 text-[9px] text-slate-400 shrink-0">
                                      <Paperclip size={9} />{lead.adjuntos}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[160px]"><span className="truncate block" title={lead.cliente}>{lead.cliente || "—"}</span></td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{lead.comercial || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {lead.linea ? <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 font-medium">{lead.linea}</span> : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ETAPA_STYLE[lead.etapa] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.etapa || "—"}</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{lead.preventa || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{lead.fechaCreacion ? lead.fechaCreacion.substring(0, 10) : "—"}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-200 whitespace-nowrap">{lead.ingresosEsperados ? COP(lead.ingresosEsperados) : "—"}</td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{lead.cierreEsperado || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${WON_STYLE[lead.ganado] ?? "bg-white/[0.06] text-slate-400"}`}>{lead.ganado}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lead.activo ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.06] text-slate-500"}`}>
                              {lead.activo ? "Sí" : "No"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{lead.ultimaModificacion || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05] bg-[#0e0e1c]">
                  <span className="text-xs text-slate-500">
                    {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} registros
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => goTo(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"><ChevronsLeft size={14} /></button>
                    <button onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                      .reduce<(number | "…")[]>((acc, p, i, arr) => {
                        if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                        acc.push(p); return acc;
                      }, [])
                      .map((item, i) =>
                        item === "…" ? (
                          <span key={`e-${i}`} className="px-1 text-xs text-slate-400">…</span>
                        ) : (
                          <button key={item} onClick={() => goTo(item as number)}
                            className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === item ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-white/[0.08]"}`}>
                            {item}
                          </button>
                        )
                      )}
                    <button onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                    <button onClick={() => goTo(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.08] disabled:opacity-30 transition-colors"><ChevronsRight size={14} /></button>
                  </div>
                </div>
              )}
            </div>

            <TodayLeadsWidget leads={leads} />
          </div>
        )}
      </div>

      {/* 1. modal detalle desde tabla principal */}
      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  );
}
