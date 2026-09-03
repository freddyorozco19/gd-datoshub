"use client";

import { useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw, Search, Download, ChevronUp, ChevronDown,
  Users, AlertCircle,
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, X, History,
  ExternalLink, Sparkles, Calendar,
  Trophy, Activity, Maximize2,
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
  Ganado:     "bg-emerald-500/10 text-emerald-400",
  Perdido:    "bg-rose-500/10 text-rose-400",
  Pendiente:  "bg-blue-500/10 text-blue-400",
};

const ETAPA_STYLE: Record<string, string> = {
  "Nuevo":               "bg-white/[0.06] text-slate-400",
  "En proceso":          "bg-sky-500/10 text-sky-400",
  "Propuesta enviada":   "bg-violet-500/10 text-violet-400",
  "Negociación":         "bg-amber-500/10 text-amber-400",
  "Ganado":              "bg-emerald-500/10 text-emerald-400",
  "Perdido":             "bg-rose-500/10 text-rose-400",
};

/* ── alias de visualización para nombres de línea ───────────────────── */
const lineaLabel = (l: string): string => {
  if (l.toUpperCase().startsWith("DATOS Y SISTEMAS")) return "DATOS";
  return l;
};

/* ── paleta de colores para líneas ──────────────────────────────────── */
const LINE_PALETTE = [
  { bar: "bg-blue-500",    badge: "bg-blue-500/10 text-blue-400",    text: "text-blue-400",    glow: "shadow-[0_0_12px_-2px_rgba(59,130,246,0.6)]"  },
  { bar: "bg-violet-500",  badge: "bg-violet-500/10 text-violet-400",text: "text-violet-400",  glow: "shadow-[0_0_12px_-2px_rgba(139,92,246,0.6)]"  },
  { bar: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-400",text: "text-emerald-400",glow: "shadow-[0_0_12px_-2px_rgba(16,185,129,0.6)]"  },
  { bar: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-400",  text: "text-amber-400",   glow: "shadow-[0_0_12px_-2px_rgba(245,158,11,0.6)]"  },
  { bar: "bg-rose-500",    badge: "bg-rose-500/10 text-rose-400",    text: "text-rose-400",    glow: "shadow-[0_0_12px_-2px_rgba(244,63,94,0.6)]"   },
  { bar: "bg-cyan-500",    badge: "bg-cyan-500/10 text-cyan-400",    text: "text-cyan-400",    glow: "shadow-[0_0_12px_-2px_rgba(6,182,212,0.6)]"   },
  { bar: "bg-orange-500",  badge: "bg-orange-500/10 text-orange-400",text: "text-orange-400",  glow: "shadow-[0_0_12px_-2px_rgba(249,115,22,0.6)]"  },
  { bar: "bg-indigo-500",  badge: "bg-indigo-500/10 text-indigo-400",text: "text-indigo-400",  glow: "shadow-[0_0_12px_-2px_rgba(99,102,241,0.6)]"  },
];

/* ── skeleton de tabla ────────────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="flex-1 min-w-0 bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/[0.05] bg-black/20 backdrop-blur-md">
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

/* ── mapa de calor ───────────────────────────────────────────────────── */
function LeadHeatmap({ leads }: { leads: Lead[] }) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
    <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] backdrop-blur-xl p-4 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45)] overflow-hidden">
      {/* sheen superior, efecto de cristal */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

      <div className="relative mb-3">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 shrink-0">
            <Activity size={15} className="text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-slate-100 uppercase tracking-wide">Actividad de leads</span>
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
                  <button
                    key={date}
                    type="button"
                    onClick={() => count > 0 && setSelectedDay(date)}
                    disabled={count === 0}
                    title={`${date}: ${count} lead${count !== 1 ? "s" : ""}`}
                    className={`rounded-sm transition-opacity hover:opacity-70 ${count > 0 ? "cursor-pointer" : "cursor-default"} ${COLORS[level]}`}
                    style={{ width: "100%", aspectRatio: "1 / 1" }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedDay && (
        <DayLeadsModal
          leads={leads.filter((l) => l.fechaCreacion.startsWith(selectedDay))}
          date={selectedDay}
          onClose={() => setSelectedDay(null)}
        />
      )}
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
  const [mSort, setMSort] = useState<{ key: keyof Lead; dir: "asc" | "desc" }>({ key: "nombre", dir: "asc" });

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
    data.sort((a, b) => {
      const av = a[mSort.key] ?? "", bv = b[mSort.key] ?? "";
      const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return mSort.dir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [leads, mLinea, mComercial, mEstado, mSort]);

  function mToggleSort(key: keyof Lead) {
    setMSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const anyActive = mLinea !== "ALL" || mComercial !== "ALL" || mEstado !== "ALL";

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && !detailLead) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, detailLead]);

  const modal = (
    <div
      className="dashboard-shell fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "var(--app-modal-overlay)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="app-bar modal-header flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
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

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 border-b border-white/[0.05] bg-black/20 backdrop-blur-md">
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
              <thead className="sticky top-0 bg-black/40 backdrop-blur-md border-b border-white/[0.07]">
                <tr>
                  {([ ["nombre","Nombre"], ["cliente","Cliente"], ["comercial","Comercial"], ["linea","Línea"], ["etapa","Etapa"], ["tipoOportunidad","Tipo Oportunidad"], ["preventa","Preventa"], ["ingresosEsperados","Ingresos Esp."], ["ganado","Estado"] ] as [keyof Lead, string][]).map(([key, label]) => (
                    <th key={key} onClick={() => mToggleSort(key)}
                      className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-white select-none transition-colors">
                      <span className="flex items-center gap-1">
                        {label}
                        {mSort.key === key
                          ? mSort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                          : <ChevronDown size={12} className="opacity-20" />}
                      </span>
                    </th>
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
      className="dashboard-shell fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "var(--app-modal-overlay)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="app-bar modal-header flex items-start justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-semibold text-slate-100 text-base leading-snug" title={lead.nombre}>{lead.nombre}</h2>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.1] text-slate-300 tracking-wide">ID {lead.id}</span>
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

          <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
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

          <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
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

          <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Financiero</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Ingresos Esperados" value={lead.ingresosEsperados ? COP(lead.ingresosEsperados) : null} />
              <Field label="Consultoría COP"    value={lead.consultoriaCOP    ? COP(lead.consultoriaCOP)    : null} />
              <Field label="Datos COP"          value={lead.datosCOP          ? COP(lead.datosCOP)          : null} />
              <Field label="TI COP"             value={lead.tiCOP             ? COP(lead.tiCOP)             : null} />
            </div>
          </section>

          {(lead.alcance || lead.objeto) && (
            <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Alcance & Objeto</h3>
              <div className="space-y-3">
                {lead.alcance && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Alcance</p><p className="text-xs text-slate-200 leading-relaxed">{lead.alcance}</p></div>}
                {lead.objeto  && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Objeto</p><p className="text-xs text-slate-200 leading-relaxed">{lead.objeto}</p></div>}
              </div>
            </section>
          )}

          <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
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
            <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
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
    <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] backdrop-blur-xl p-4 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45)] overflow-hidden">
      {/* sheen superior, efecto de cristal */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 shrink-0"><History size={15} className="text-violet-400" /></div>
        <span className="text-sm font-semibold text-slate-100 flex-1">Últimas asignadas</span>
      </div>

      {availableLineas.length > 0 && (
        <div className="flex gap-1 mb-3 overflow-x-auto pb-0.5">
          {availableLineas.map((linea) => {
            const palette = lineaColor[linea] ?? LINE_PALETTE[0];
            const active = lineaFilter.includes(linea);
            return (
              <button
                key={linea}
                type="button"
                title={linea}
                onClick={() => toggleLinea(linea)}
                className={`shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-all duration-150 whitespace-nowrap ${
                  active
                    ? `${palette.badge} border-current/[0.15]`
                    : "text-slate-500 bg-white/[0.03] border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.05] hover:border-white/[0.12]"
                }`}
              >
                {lineaLabel(linea)}
              </button>
            );
          })}
        </div>
      )}

      {recent.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">Sin leads en las líneas seleccionadas</p>
      ) : (
        <div className="relative divide-y divide-white/[0.05]">
          {recent.map((lead, i) => {
            const palette = lineaColor[lead.linea] ?? LINE_PALETTE[0];
            const fecha = lead.fechaCreacion ? lead.fechaCreacion.substring(0, 10) : "";
            const hora  = lead.fechaCreacion && lead.fechaCreacion.length >= 16 ? lead.fechaCreacion.substring(11, 16) : "";
            return (
              <button key={lead.id} type="button" onClick={() => setSelectedLead(lead)}
                className="w-full flex gap-2.5 items-start text-left px-1.5 py-2.5 hover:bg-white/[0.05] rounded-lg transition-colors group">
                <span className="text-[10px] font-bold text-slate-500 mt-0.5 w-3.5 shrink-0 text-right group-hover:text-white transition-colors">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-100 truncate leading-snug group-hover:text-white transition-colors" title={lead.nombre}>{lead.nombre}</p>
                  {lead.cliente && <p className={`text-[10px] truncate leading-tight mt-0.5 font-medium ${palette.text}`}>{lead.cliente}</p>}
                  {fecha && <p className="text-[9px] text-slate-500 leading-tight mt-1 whitespace-nowrap">{fecha}{hora && <> · {hora}</>}</p>}
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
  const [expanded, setExpanded] = useState(false);

  const comercialLeads = useMemo(
    () => {
      if (!selectedComercial) return [];
      const byComercial = leads.filter((l) => (l.comercial || "Sin asignar") === selectedComercial);
      if (sortBy === "ganados") return byComercial.filter((l) => l.ganado === "Ganado");
      return byComercial;
    },
    [leads, selectedComercial, sortBy]
  );

  const fullRanking = useMemo(() => {
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
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [leads, sortBy]);

  const ranking = useMemo(() => fullRanking.slice(0, 7), [fullRanking]);

  const maxVal = Math.max(...ranking.map((r) => r[sortBy]), 1);
  const maxValFull = Math.max(...fullRanking.map((r) => r[sortBy]), 1);

  function fmt(r: typeof ranking[0]) {
    if (sortBy === "ingresos")
      return r.ingresos >= 1_000_000
        ? `$${(r.ingresos / 1_000_000).toFixed(1)}M`
        : `$${(r.ingresos / 1_000).toFixed(0)}K`;
    return String(r[sortBy]);
  }

  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] backdrop-blur-xl p-4 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45)] overflow-hidden">
      {/* sheen superior, efecto de cristal */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
      <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 shrink-0">
          <Users size={15} className="text-violet-400" />
        </div>
        <span className="text-sm font-semibold text-slate-100 flex-1">Ranking</span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Ver ranking completo"
          className="p-1 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-white/[0.06] transition-colors"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* tabs de ordenamiento */}
      <div className="flex gap-1 mb-3">
        {(["leads", "ganados", "ingresos"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            className={`flex-1 text-[10px] font-semibold py-1.5 rounded-lg border transition-all duration-150 capitalize ${
              sortBy === key
                ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                : "text-slate-500 bg-white/[0.03] border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.05]"
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
            className="w-full text-left rounded-lg px-1.5 py-1 -mx-1.5 hover:bg-violet-500/10 transition-colors group focus:outline-none"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-4 text-center shrink-0 text-[10px] font-bold text-slate-300">{i + 1}</span>
                <span className="text-xs text-slate-200 truncate leading-none group-hover:text-violet-400 transition-colors" title={r.name}>{r.name}</span>
              </div>
              <span className="text-[10px] font-bold text-slate-600 shrink-0 ml-2">{fmt(r)}</span>
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden ml-5">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-500"
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

      {expanded && createPortal(
        <div
          className="dashboard-shell fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "var(--app-modal-overlay)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}
        >
          <div className="modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
            <div className="app-bar modal-header flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-white/[0.12] shrink-0"><Users size={15} /></div>
                <h2 className="font-semibold text-base text-white">Ranking completo</h2>
              </div>
              <button onClick={() => setExpanded(false)} className="p-2 rounded-lg text-slate-300 hover:bg-white/[0.1] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4">
              <div className="flex gap-1 mb-4">
                {(["leads", "ganados", "ingresos"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setSortBy(key)}
                    className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg border transition-all duration-150 capitalize ${
                      sortBy === key
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                        : "text-slate-500 bg-white/[0.03] border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {fullRanking.map((r, i) => (
                  <button
                    key={r.name}
                    type="button"
                    onClick={() => { setSelectedComercial(r.name); setExpanded(false); }}
                    title={`Ver leads de ${r.name}`}
                    className="w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-violet-500/10 transition-colors group focus:outline-none"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 text-center shrink-0 text-xs font-bold text-slate-400">{i + 1}</span>
                        <span className="text-sm text-slate-200 truncate group-hover:text-violet-400 transition-colors" title={r.name}>{r.name}</span>
                      </div>
                      <span className="text-xs font-bold text-slate-500 shrink-0 ml-2">{fmt(r)}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden ml-7">
                      <div
                        className="h-full bg-violet-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((r[sortBy] / maxValFull) * 100)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
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
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openDatePicker() {
    const el = dateInputRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  }

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
      <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] backdrop-blur-xl p-4 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.45)] overflow-hidden">
        {/* sheen superior, efecto de cristal */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-1 mb-4">
          <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 transition-colors shrink-0"><ChevronLeft size={14} /></button>

          <button
            type="button"
            onClick={() => setModal({ leads: dayLeads })}
            disabled={dayLeads.length === 0}
            title="Ver tabla de leads"
            className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.04] hover:border-white/[0.18] hover:bg-white/[0.06] disabled:cursor-default disabled:hover:bg-white/[0.04] disabled:hover:border-white/[0.1] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <span className="text-sm font-semibold text-slate-100 capitalize truncate">{fmtLabel}</span>
            <span
              role="button"
              tabIndex={0}
              title="Elegir fecha"
              onClick={(e) => { e.stopPropagation(); openDatePicker(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); openDatePicker(); } }}
              className="shrink-0 p-1 -m-1 rounded text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Calendar size={14} />
            </span>
          </button>
          <input ref={dateInputRef} type="date" value={selectedDate} max={todayGMT5()}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            tabIndex={-1} className="sr-only" />

          <button onClick={() => shiftDay(1)} disabled={isToday}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-30 transition-colors shrink-0"><ChevronRight size={14} /></button>
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
  etapaPreventa:   string;
  preventa:        string;
  activo:          string;
  etapa:           string;  // funnel click
  dateFrom:        string;
  dateTo:          string;
}

const filterOptionLabel = (o: string) => (o === "ALL" ? "TODOS" : o === "true" ? "Activo" : o === "false" ? "Inactivo" : o);

/* ── helpers de fecha para el slider de rango ─────────────────────────── */
const DAY_MS = 86400000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dateToIdx = (dateStr: string, minStr: string) => Math.round((new Date(dateStr).getTime() - new Date(minStr).getTime()) / DAY_MS);
const idxToDate = (idx: number, minStr: string) => {
  const d = new Date(minStr);
  d.setDate(d.getDate() + idx);
  return d.toISOString().substring(0, 10);
};
const fmtShortDate = (d: string) => new Date(d).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/-/g, "/");

/* ── accesos rápidos del popup de fecha ──────────────────────────────── */
const DATE_PRESETS: { key: string; label: string }[] = [
  { key: "month",    label: "Mes" },
  { key: "quarter",  label: "Trimestre" },
  { key: "semester", label: "Semestre" },
  { key: "year",     label: "Año" },
  { key: "all",      label: "Todo" },
];

/* ── slider de rango de fecha (reemplaza los inputs Desde/Hasta) ──────── */
function DateRangeSlider({
  min, max, from, to, onChange,
}: { min: string; max: string; from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 6, left: r.left });
    }
    setOpen((o) => !o);
  }

  const totalDays  = Math.max(1, dateToIdx(max, min));
  const fromDate   = from || min;
  const toDate     = to   || max;
  const fromIdx    = clamp(dateToIdx(fromDate, min), 0, totalDays);
  const toIdx      = clamp(dateToIdx(toDate, min), 0, totalDays);

  function handleFrom(v: number) {
    const nextFrom = Math.min(v, toIdx);
    onChange(idxToDate(nextFrom, min), idxToDate(toIdx, min));
  }
  function handleTo(v: number) {
    const nextTo = Math.max(v, fromIdx);
    onChange(idxToDate(fromIdx, min), idxToDate(nextTo, min));
  }

  function applyPreset(key: string) {
    if (key === "all") { onChange(min, max); setOpen(false); return; }
    const end   = new Date(max);
    const start = new Date(end);
    if (key === "month")         start.setMonth(start.getMonth() - 1);
    else if (key === "quarter")  start.setMonth(start.getMonth() - 3);
    else if (key === "semester") start.setMonth(start.getMonth() - 6);
    else if (key === "year")     start.setFullYear(start.getFullYear() - 1);
    let startStr = start.toISOString().substring(0, 10);
    if (startStr < min) startStr = min;
    onChange(startStr, max);
    setOpen(false);
  }

  const pctFrom = (fromIdx / totalDays) * 100;
  const pctTo   = (toIdx / totalDays) * 100;

  const hasCustomRange = !!(from || to);

  return (
    <div className="flex flex-col gap-1.5 shrink-0 w-60">
      <div className="flex items-center justify-center gap-1">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Rango de fecha</label>
        {hasCustomRange && (
          <button
            type="button"
            onClick={() => onChange("", "")}
            title="Limpiar rango de fecha"
            className="text-slate-500 hover:text-rose-400 transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 h-8">
        <button
          type="button" ref={btnRef} onClick={toggle}
          title="Configurar rango de fecha"
          className={`shrink-0 p-0.5 rounded transition-colors ${open ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
        >
          <Calendar size={14} />
        </button>

        <span className="shrink-0 text-[9px] text-slate-400 tabular-nums whitespace-nowrap">{fmtShortDate(fromDate)}</span>

        <div className="dual-range relative h-5 flex-1 min-w-[60px] flex items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/[0.1]" />
          <div
            className="absolute h-1 rounded-full bg-blue-500"
            style={{ left: `${pctFrom}%`, right: `${100 - pctTo}%` }}
          />
          <input
            type="range" min={0} max={totalDays} value={fromIdx}
            onChange={(e) => handleFrom(Number(e.target.value))}
            className="dual-range-input"
          />
          <input
            type="range" min={0} max={totalDays} value={toIdx}
            onChange={(e) => handleTo(Number(e.target.value))}
            className="dual-range-input"
          />
        </div>

        <span className="shrink-0 text-[9px] text-slate-400 tabular-nums whitespace-nowrap">{fmtShortDate(toDate)}</span>
      </div>

      {open && rect && createPortal(
        <div className="dashboard-shell">
          <div
            ref={panelRef}
            style={{
              position: "fixed", top: rect.top, left: rect.left,
              backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
            }}
            className="z-50 w-64 rounded-lg border border-white/[0.12] bg-white/[0.08] shadow-2xl shadow-black/40 p-3 flex flex-col gap-3"
          >
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rango personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Desde</span>
                  <input
                    type="date" value={fromDate} min={min} max={toDate}
                    onChange={(e) => onChange(e.target.value, toDate)}
                    className="text-xs rounded-lg px-2 py-1.5 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:outline-none focus:border-blue-500/60 text-slate-200 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Hasta</span>
                  <input
                    type="date" value={toDate} min={fromDate} max={max}
                    onChange={(e) => onChange(fromDate, e.target.value)}
                    className="text-xs rounded-lg px-2 py-1.5 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:outline-none focus:border-blue-500/60 text-slate-200 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-white/[0.08]" />

            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Accesos rápidos</p>
              <div className="grid grid-cols-3 gap-1.5">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key} type="button" onClick={() => applyPreset(p.key)}
                    className="text-[11px] px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.1] hover:bg-white/[0.08] hover:border-white/[0.18] text-slate-300 hover:text-white transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ── dropdown de filtro (fuera de LeadsView para no perder su estado
   "open" en cada re-render del padre, ej. al sincronizar leads) ────────── */
function FilterSelect({
  label,
  value,
  onChange,
  options,
  headerAction,
  widthClass = "w-28",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  headerAction?: ReactNode;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen((o) => !o);
  }

  return (
    <div className={`flex flex-col gap-1.5 shrink-0 ${widthClass}`}>
      <div className="flex items-center justify-center gap-1">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{label}</label>
        {headerAction}
      </div>
      <button
        type="button"
        ref={btnRef}
        onClick={toggle}
        className="text-xs rounded-lg px-2.5 py-2 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:outline-none focus:border-blue-500/60 text-slate-200 transition-colors cursor-pointer w-full flex items-center justify-between gap-1"
      >
        <span className="truncate">{filterOptionLabel(value)}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && rect && createPortal(
        // .dashboard-shell envuelve el panel para que los overrides de tema
        // claro (que requieren ese ancestro) sigan aplicando fuera del árbol
        // normal — el portal lo saca de .dashboard-shell hacia document.body.
        <div className="dashboard-shell">
          <div
            ref={panelRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)" }}
            className="modal-panel max-h-64 overflow-auto z-50 rounded-lg border border-white/[0.12] shadow-2xl shadow-black/40 py-1"
          >
            {options.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                  o === value ? "filter-option-selected" : "filter-option text-slate-300"
                }`}
              >
                {filterOptionLabel(o)}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
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
  const frozenBodyRef    = useRef<HTMLTableSectionElement>(null);
  const scrollBodyRef    = useRef<HTMLTableSectionElement>(null);
  const frozenColRef     = useRef<HTMLDivElement>(null);   // div absoluto de NOMBRE
  const rightScrollRef   = useRef<HTMLDivElement>(null);   // overflow-x-auto oculto
  const extScrollRef     = useRef<HTMLDivElement>(null);   // scrollbar externo visible
  const extScrollInner   = useRef<HTMLDivElement>(null);   // div fantasma que da el ancho

  const [search,  setSearch]  = useState("");
  const [filters, setFilters] = useState<Filters>({
    comercial: "ALL", linea: "ALL",
    etapaPreventa: "ALL", preventa: "ALL", activo: "ALL",
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
    etapaPreventa:   unique(leads.map((l) => l.etapaPreventa)),
    preventa:        unique(leads.map((l) => l.preventa)),
    etapa:           unique(leads.map((l) => l.etapa)),
  }), [leads]);

  /* límites del slider de fecha — del primer lead cargado a hoy */
  const dateBounds = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    if (!leads.length) {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return { min: d.toISOString().substring(0, 10), max: today };
    }
    const days = leads.map((l) => l.fechaCreacion.substring(0, 10)).filter(Boolean).sort();
    return { min: days[0], max: days[days.length - 1] > today ? days[days.length - 1] : today };
  }, [leads]);

  /* datos filtrados */
  const filtered = useMemo(() => {
    let data = [...leads];
    if (filters.comercial       !== "ALL") data = data.filter((l) => l.comercial       === filters.comercial);
    if (filters.linea           !== "ALL") data = data.filter((l) => l.linea           === filters.linea);
    if (filters.etapaPreventa   !== "ALL") data = data.filter((l) => l.etapaPreventa   === filters.etapaPreventa);
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

  /* sincroniza alturas entre la columna fija y las columnas scrollables */
  useEffect(() => {
    const syncHeights = () => {
      const fRows = frozenBodyRef.current ? Array.from(frozenBodyRef.current.rows) : [];
      const sRows = scrollBodyRef.current ? Array.from(scrollBodyRef.current.rows) : [];
      const n = Math.min(fRows.length, sRows.length);
      if (n === 0) return;
      for (let i = 0; i < n; i++) { fRows[i].style.height = ""; sRows[i].style.height = ""; }
      const heights: number[] = [];
      for (let i = 0; i < n; i++) heights.push(Math.max(fRows[i].offsetHeight, sRows[i].offsetHeight));
      for (let i = 0; i < n; i++) { fRows[i].style.height = `${heights[i]}px`; sRows[i].style.height = `${heights[i]}px`; }
    };

    const r1 = requestAnimationFrame(() => requestAnimationFrame(syncHeights));
    const t1 = setTimeout(syncHeights, 120);

    let rafId = 0;
    const debouncedSync = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(syncHeights); };
    const ro = new ResizeObserver(debouncedSync);
    if (frozenBodyRef.current) ro.observe(frozenBodyRef.current);
    if (scrollBodyRef.current) ro.observe(scrollBodyRef.current);

    return () => { cancelAnimationFrame(r1); clearTimeout(t1); cancelAnimationFrame(rafId); ro.disconnect(); };
  }, [paginated, loading]);

  /* sincroniza scroll horizontal entre el contenedor oculto y el scrollbar externo */
  useEffect(() => {
    const table = rightScrollRef.current;
    const bar   = extScrollRef.current;
    if (!table || !bar) return;
    let busy = false;
    const onTable = () => { if (!busy) { busy = true; bar.scrollLeft   = table.scrollLeft; busy = false; } };
    const onBar   = () => { if (!busy) { busy = true; table.scrollLeft = bar.scrollLeft;   busy = false; } };
    table.addEventListener("scroll", onTable, { passive: true });
    bar.addEventListener("scroll",   onBar,   { passive: true });
    return () => { table.removeEventListener("scroll", onTable); bar.removeEventListener("scroll", onBar); };
  }, [paginated, loading]);

  /* mantiene el ancho del scrollbar externo igual al scrollWidth de la tabla */
  useEffect(() => {
    const table = rightScrollRef.current;
    const inner = extScrollInner.current;
    if (!table || !inner) return;
    const update = () => { inner.style.width = table.scrollWidth + "px"; };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(table);
    return () => ro.disconnect();
  }, [paginated, loading]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.comercial       !== "ALL") c++;
    if (filters.linea           !== "ALL") c++;
    if (filters.etapaPreventa   !== "ALL") c++;
    if (filters.preventa        !== "ALL") c++;
    if (filters.activo          !== "ALL") c++;
    if (filters.etapa           !== "ALL") c++;
    if (search.trim())                     c++;
    return c;
  }, [filters, search]);

  function clearFilters() {
    setFilters({
      comercial: "ALL", linea: "ALL",
      etapaPreventa: "ALL", preventa: "ALL", activo: "ALL",
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


  const newCount = newLeadIds.size;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar title="Leads" subtitle="Oportunidades sincronizadas desde ODOO CRM" />

      <div className="flex-1 overflow-auto p-5 space-y-4 relative">

        {/* ── barra de filtros (sin panel envolvente) ── */}
        <div>
          {/* todo en filas — sin scroll horizontal, se ajusta con wrap */}
          <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
            <FilterSelect label="Comercial"   value={filters.comercial}     onChange={(v) => setFilters((f) => ({ ...f, comercial: v }))}     options={opts.comercial} />
            <FilterSelect label="Línea"       value={filters.linea}         onChange={(v) => setFilters((f) => ({ ...f, linea: v }))}         options={opts.linea} />
            <FilterSelect label="Etapa Prev." value={filters.etapaPreventa} onChange={(v) => setFilters((f) => ({ ...f, etapaPreventa: v }))} options={opts.etapaPreventa} />
            <FilterSelect label="Preventa"    value={filters.preventa}      onChange={(v) => setFilters((f) => ({ ...f, preventa: v }))}      options={opts.preventa} />
            <FilterSelect
              label="Etapa Actual" value={filters.etapa}
              onChange={(v) => setFilters((f) => ({ ...f, etapa: v }))}
              options={opts.etapa}
              headerAction={activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  title={`Limpiar todo (${activeFilterCount})`}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <X size={11} />
                </button>
              )}
            />

            <div className="w-px self-stretch bg-white/[0.08] shrink-0 mx-0.5" />

            {/* rango de fechas — slider único con popup de configuración */}
            <DateRangeSlider
              min={dateBounds.min}
              max={dateBounds.max}
              from={filters.dateFrom}
              to={filters.dateTo}
              onChange={(from, to) => setFilters((f) => ({ ...f, dateFrom: from, dateTo: to }))}
            />

            <div className="w-px self-stretch bg-white/[0.08] shrink-0 mx-0.5" />

            {/* búsqueda + acciones */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap text-center">Buscar</label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nombre, cliente…"
                    className="pl-8 pr-3 py-2 text-xs rounded-lg w-44 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:outline-none focus:border-blue-500/60 text-slate-200 placeholder-slate-600 transition-colors"
                  />
                </div>

                {/* botones de acción — solo icono */}
                <button
                  onClick={loadLeads}
                  disabled={loading}
                  title="Sincronizar ODOO"
                  className="flex items-center justify-center p-2 rounded-lg border border-white/[0.1] bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] hover:border-white/[0.18] disabled:opacity-50 transition-colors shrink-0"
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={exportCSV}
                  disabled={!filtered.length}
                  title="Exportar CSV"
                  className="flex items-center justify-center p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

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
                <div key={h} className="bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] p-4 animate-pulse" style={{ height: h }}>
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
            <div className="flex-1 min-w-0 bg-white/[0.04] backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
              {/* tabla — scrollbar nativo oculto con CSS; scrollbar externo debajo */}
              <div className="relative" style={{ paddingLeft: 244 }}>

                {/* ── columna NOMBRE: absoluta, nunca dentro del área scrollable ── */}
                <div ref={frozenColRef} className="absolute left-0 top-0 z-20 border-r border-white/[0.07]" style={{ width: 244 }}>
                <table className="leads-table text-xs w-full">
                  <thead>
                    <tr className="bg-black/20 backdrop-blur-md border-b border-white/[0.07]">
                      <th
                        onClick={() => toggleSort("nombre")}
                        className="text-left px-3 py-3 font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-white select-none whitespace-nowrap"
                      >
                        <span className="flex items-center gap-1">Nombre <SortIcon col="nombre" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody ref={frozenBodyRef}>
                    {filtered.length === 0 ? (
                      <tr><td className="px-3 py-12" /></tr>
                    ) : paginated.map((lead, i) => {
                      const isNew = newLeadIds.has(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className={`border-b border-white/[0.06] transition-colors cursor-pointer group ${
                            isNew ? "bg-emerald-500/10 hover:bg-emerald-500/20" : i % 2 === 1 ? "bg-white/[0.02] hover:bg-blue-500/10" : "hover:bg-blue-500/10"
                          }`}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-start gap-1.5">
                              {isNew && (
                                <span className="mt-0.5 shrink-0 text-[8px] font-bold px-1 py-px rounded bg-emerald-500 text-white uppercase leading-tight">NEW</span>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-white max-w-[200px] truncate" title={lead.nombre}>{lead.nombre}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {lead.correo && <p className="text-slate-500 truncate max-w-[170px] text-[10px]">{lead.correo}</p>}
                                  {lead.adjuntos > 0 && (
                                    <span className="flex items-center gap-0.5 text-[9px] text-slate-500 shrink-0">
                                      <Paperclip size={9} />{lead.adjuntos}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>{/* ── cierre div NOMBRE absoluto ── */}

                {/* ── panel derecho: scrollbar nativo oculto con .no-scrollbar; scrollbar externo fuera ── */}
                <div ref={rightScrollRef} className="overflow-x-auto no-scrollbar" style={{ scrollbarWidth: "none" } as React.CSSProperties}>
                <div className="w-full min-w-max">
                  <table className="leads-table text-xs w-full">
                    <thead>
                      <tr className="bg-black/20 backdrop-blur-md border-b border-white/[0.07]">
                        {(
                          [
                            ["id",                 "ID"],
                            ["cliente",            "Cliente"],
                            ["comercial",          "Comercial"],
                            ["linea",              "Línea"],
                            ["preventa",           "Preventa"],
                            ["etapaPreventa",      "Etapa Preventa"],
                            ["fechaCreacion",      "Fecha Creación"],
                            ["ingresosEsperados",  "Ingresos Esp."],
                            ["cierreEsperado",     "Cierre Esp."],
                            ["etapa",              "Etapa Actual"],
                            ["ganado",             "Ganado"],
                            ["activo",             "Activo"],
                            ["ultimaModificacion", "Actualizado"],
                          ] as [SortKey, string][]
                        ).map(([key, label]) => (
                          <th
                            key={key}
                            onClick={() => toggleSort(key)}
                            className="text-left px-3 py-3 font-semibold text-slate-400 uppercase tracking-wide cursor-pointer hover:text-white select-none whitespace-nowrap"
                          >
                            <span className="flex items-center gap-1">{label}<SortIcon col={key} /></span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody ref={scrollBodyRef}>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="px-4 py-12 text-center text-slate-400 text-sm">
                            Sin leads con los filtros aplicados
                          </td>
                        </tr>
                      ) : paginated.map((lead, i) => {
                        const isNew = newLeadIds.has(lead.id);
                        return (
                          <tr
                            key={lead.id}
                            onClick={() => setSelectedLead(lead)}
                            className={`border-b border-white/[0.06] transition-colors cursor-pointer ${
                              isNew ? "bg-emerald-500/10 hover:bg-emerald-500/20" : i % 2 === 1 ? "bg-white/[0.02] hover:bg-blue-500/10" : "hover:bg-blue-500/10"
                            }`}
                          >
                            <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{lead.id}</td>
                            <td className="px-3 py-3 text-slate-300 max-w-[160px]"><span className="truncate block" title={lead.cliente}>{lead.cliente || "—"}</span></td>
                            <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{lead.comercial || "—"}</td>
                            <td className="px-3 py-3 whitespace-nowrap max-w-[180px]">
                              {lead.linea ? <span className="text-slate-300 truncate inline-block max-w-full align-bottom" title={lead.linea}>{lineaLabel(lead.linea)}</span> : <span className="text-slate-600">—</span>}
                            </td>
                            <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{lead.preventa || "—"}</td>
                            <td className="px-3 py-3 text-slate-300 whitespace-nowrap">{lead.etapaPreventa || "—"}</td>
                            <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{lead.fechaCreacion ? lead.fechaCreacion.substring(0, 10) : "—"}</td>
                            <td className="px-3 py-3 text-right font-semibold text-white whitespace-nowrap">{lead.ingresosEsperados ? COP(lead.ingresosEsperados) : "—"}</td>
                            <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{lead.cierreEsperado || "—"}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ETAPA_STYLE[lead.etapa] ?? "bg-white/[0.06] text-slate-300"}`}>{lead.etapa || "—"}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${WON_STYLE[lead.ganado] ?? "bg-white/[0.06] text-slate-300"}`}>{lead.ganado || "—"}</span>
                            </td>
                            <td className="px-3 py-3 text-center text-slate-300">
                              {lead.activo ? "Sí" : "No"}
                            </td>
                            <td className="px-3 py-3 text-slate-400 whitespace-nowrap">{lead.ultimaModificacion || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </div>{/* ── cierre overflow-x-auto oculto ── */}

              </div>{/* ── cierre relative wrapper ── */}

              {/* scrollbar externo — fuera de la tabla, sincronizado por JS */}
              <div
                ref={extScrollRef}
                className="overflow-x-auto border-t border-white/[0.05]"
                style={{ marginLeft: 244 }}
              >
                <div ref={extScrollInner} style={{ height: 1 }} />
              </div>

              {/* pie: datetime + conteo + paginación */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.05] bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {totalPages > 1
                      ? `${((currentPage - 1) * PAGE_SIZE) + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} de ${filtered.length} registros`
                      : `${filtered.length} registros`}
                  </span>
                  {lastFetch && (
                    <span className="text-xs text-slate-600">· actualizado {lastFetch.toLocaleTimeString("es-CO")}</span>
                  )}
                  {newCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                      <Sparkles size={10} />
                      {newCount} nuevo{newCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {loading && <RefreshCw size={13} className="animate-spin text-blue-500" />}
                </div>
                {totalPages > 1 && (
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
                )}
              </div>
            </div>

            <TodayLeadsWidget leads={filtered} />
          </div>
        )}
      </div>

      {/* 1. modal detalle desde tabla principal */}
      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  );
}
