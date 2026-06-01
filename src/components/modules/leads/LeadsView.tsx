"use client";

import { useEffect, useRef, useState, useMemo, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  RefreshCw, Search, Download, ChevronUp, ChevronDown,
  TrendingUp, Users, Clock, DollarSign, AlertCircle,
  CalendarCheck2, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Eye, X, History,
  ExternalLink, Sparkles, SlidersHorizontal, Calendar,
} from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import Topbar from "@/components/layout/Topbar";

const ODOO_BASE = "https://grow-data.odoo.com";

/* ── helpers ─────────────────────────────────────────────────────────── */

const COP = (v: number) =>
  v ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v) : "—";

const unique = (arr: string[]) =>
  ["ALL", ...Array.from(new Set(arr.filter(Boolean))).sort()];

const fmtDate = (s: string) => (s ? s.substring(0, 10) : "—");

const WON_STYLE: Record<string, string> = {
  Ganado:        "bg-emerald-100 text-emerald-700",
  Perdido:       "bg-rose-100 text-rose-700",
  "En progreso": "bg-blue-100 text-blue-700",
};

const ETAPA_STYLE: Record<string, string> = {
  "Nuevo":               "bg-slate-100 text-slate-600",
  "En proceso":          "bg-sky-100 text-sky-700",
  "Propuesta enviada":   "bg-violet-100 text-violet-700",
  "Negociación":         "bg-amber-100 text-amber-700",
  "Ganado":              "bg-emerald-100 text-emerald-700",
  "Perdido":             "bg-rose-100 text-rose-700",
};

/* ── alias de visualización para nombres de línea ───────────────────── */
const lineaLabel = (l: string): string => {
  if (l.toUpperCase().startsWith("DATOS Y SISTEMAS")) return "DATOS";
  return l;
};

/* ── paleta de colores para líneas ──────────────────────────────────── */
const LINE_PALETTE = [
  { bar: "bg-blue-500",    badge: "bg-blue-100 text-blue-700" },
  { bar: "bg-violet-500",  badge: "bg-violet-100 text-violet-700" },
  { bar: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700" },
  { bar: "bg-amber-500",   badge: "bg-amber-100 text-amber-700" },
  { bar: "bg-rose-500",    badge: "bg-rose-100 text-rose-700" },
  { bar: "bg-cyan-500",    badge: "bg-cyan-100 text-cyan-700" },
  { bar: "bg-orange-500",  badge: "bg-orange-100 text-orange-700" },
  { bar: "bg-indigo-500",  badge: "bg-indigo-100 text-indigo-700" },
];

/* ── sparkline mini-chart ─────────────────────────────────────────────── */
function Sparkline({ data, color = "bg-blue-400" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const hasData = data.some((v) => v > 0);
  if (!hasData) return null;
  return (
    <div className="flex items-end gap-px h-7 mt-2 opacity-70">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${color}`}
          style={{ height: `${Math.max(4, Math.round((v / max) * 100))}%` }}
        />
      ))}
    </div>
  );
}

/* ── skeleton de tabla ────────────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
        <div className="h-3 w-44 bg-slate-200 rounded animate-pulse" />
      </div>
      <div className="divide-y divide-slate-50">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-3 py-3 animate-pulse">
            <div className="h-3 rounded bg-slate-200" style={{ width: `${100 + (i % 4) * 35}px` }} />
            <div className="h-3 w-24 rounded bg-slate-100" />
            <div className="h-3 w-20 rounded bg-slate-100" />
            <div className="h-3 w-16 rounded bg-slate-100" />
            <div className="h-3 w-12 rounded bg-slate-100" />
            <div className="h-3 w-16 rounded bg-slate-100 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── modal: tabla de leads del día ──────────────────────────────────── */
interface DayLeadsModalProps { leads: Lead[]; date: string; onClose: () => void; }

function DayLeadsModal({ leads, date, onClose }: DayLeadsModalProps) {
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const [mLinea,     setMLinea]     = useState("ALL");
  const [mComercial, setMComercial] = useState("ALL");
  const [mEstado,    setMEstado]    = useState("ALL");

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
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.55)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-semibold text-slate-800 capitalize">{dateLabel}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {mFiltered.length}{mFiltered.length !== leads.length && ` de ${leads.length}`}{" "}
              {leads.length === 1 ? "lead registrado" : "leads registrados"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 border-b border-slate-100 bg-slate-50">
          {([
            { label: "Línea",     val: mLinea,     set: setMLinea,     opts: mOpts.linea },
            { label: "Comercial", val: mComercial, set: setMComercial, opts: mOpts.comercial },
            { label: "Estado",    val: mEstado,    set: setMEstado,    opts: mOpts.estado },
          ] as { label: string; val: string; set: (v: string) => void; opts: string[] }[]).map(({ label, val, set, opts }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 whitespace-nowrap">{label}:</span>
              <select value={val} onChange={(e) => set(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-700">
                {opts.map((o) => <option key={o} value={o}>{o === "ALL" ? "Todos" : o}</option>)}
              </select>
            </div>
          ))}
          {anyActive && (
            <button onClick={() => { setMLinea("ALL"); setMComercial("ALL"); setMEstado("ALL"); }}
              className="text-xs text-blue-600 hover:underline ml-auto">
              Limpiar filtros
            </button>
          )}
        </div>

        <div className="overflow-auto flex-1">
          {mFiltered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Sin leads con los filtros seleccionados</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Nombre","Cliente","Comercial","Línea","Etapa","Tipo Oportunidad","Preventa","Ingresos Esp.","Estado"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {mFiltered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 max-w-[180px] truncate" title={lead.nombre}>{lead.nombre}</p>
                      {lead.correo && <p className="text-slate-400 truncate max-w-[180px] text-[10px]">{lead.correo}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[140px]"><span className="truncate block" title={lead.cliente}>{lead.cliente || "—"}</span></td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.comercial || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {lead.linea ? <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-medium">{lead.linea}</span> : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${ETAPA_STYLE[lead.etapa] ?? "bg-slate-100 text-slate-600"}`}>{lead.etapa || "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.tipoOportunidad || "—"}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{lead.preventa || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700 whitespace-nowrap">{lead.ingresosEsperados ? COP(lead.ingresosEsperados) : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${WON_STYLE[lead.ganado] ?? "bg-slate-100 text-slate-600"}`}>{lead.ganado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
  return createPortal(modal, document.body);
}

/* ── modal: detalle completo de un lead ─────────────────────────────── */
interface LeadDetailModalProps { lead: Lead; onClose: () => void; }

function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const odooUrl = `${ODOO_BASE}/web#model=crm.lead&id=${lead.id}&view_type=form`;

  const Field = ({ label, value }: { label: string; value: ReactNode }) => (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-xs text-slate-700">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  );

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15,23,42,0.6)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">ID {lead.id}</p>
            <h2 className="font-semibold text-slate-800 text-base leading-snug" title={lead.nombre}>{lead.nombre}</h2>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {lead.linea && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700">{lead.linea}</span>}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${WON_STYLE[lead.ganado] ?? "bg-slate-100 text-slate-600"}`}>{lead.ganado}</span>
              {lead.etapa && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ETAPA_STYLE[lead.etapa] ?? "bg-slate-100 text-slate-600"}`}>{lead.etapa}</span>}
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${lead.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
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
              className="p-2 rounded-lg text-slate-400 hover:bg-orange-50 hover:text-orange-500 transition-colors"
            >
              <ExternalLink size={16} />
            </a>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-slate-100">Cliente & Contacto</h3>
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
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-slate-100">Oportunidad</h3>
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
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-slate-100">Financiero</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Ingresos Esperados" value={lead.ingresosEsperados ? COP(lead.ingresosEsperados) : null} />
              <Field label="Consultoría COP"    value={lead.consultoriaCOP    ? COP(lead.consultoriaCOP)    : null} />
              <Field label="Datos COP"          value={lead.datosCOP          ? COP(lead.datosCOP)          : null} />
              <Field label="TI COP"             value={lead.tiCOP             ? COP(lead.tiCOP)             : null} />
            </div>
          </section>

          {(lead.alcance || lead.objeto) && (
            <section>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-slate-100">Alcance & Objeto</h3>
              <div className="space-y-3">
                {lead.alcance && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Alcance</p><p className="text-xs text-slate-700 leading-relaxed">{lead.alcance}</p></div>}
                {lead.objeto  && <div><p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Objeto</p><p className="text-xs text-slate-700 leading-relaxed">{lead.objeto}</p></div>}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-slate-100">Fechas</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Fecha Creación"        value={lead.fechaCreacion       ? lead.fechaCreacion.substring(0, 10)  : null} />
              <Field label="Cierre Esperado"       value={lead.cierreEsperado      || null} />
              <Field label="Fecha Efectiva Cierre" value={lead.fechaEfectivaCierre || null} />
              <Field label="Fecha Cierre"          value={lead.fechaCierre         ? lead.fechaCierre.substring(0, 10)    : null} />
              <Field label="Última Modificación"   value={lead.ultimaModificacion  || null} />
            </div>
          </section>

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
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-violet-50 shrink-0"><History size={15} className="text-violet-600" /></div>
        <span className="text-sm font-semibold text-slate-700 flex-1">Últimas asignadas</span>
      </div>

      {availableLineas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {availableLineas.map((linea) => {
            const palette = lineaColor[linea] ?? LINE_PALETTE[0];
            const active = lineaFilter.includes(linea);
            return (
              <button key={linea} type="button" title={linea} onClick={() => toggleLinea(linea)}
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition-colors truncate max-w-[96px] ${
                  active ? `${palette.badge} ring-1 ring-current` : "bg-slate-100 text-slate-400 hover:bg-slate-200"
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
                className="w-full flex gap-2 items-start text-left rounded-lg px-2 py-2 hover:bg-violet-50 hover:border-violet-200 border border-transparent transition-colors group">
                <span className="text-[10px] font-bold text-slate-300 mt-0.5 w-3.5 shrink-0 text-right group-hover:text-violet-400 transition-colors">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-800 truncate leading-snug group-hover:text-violet-700 transition-colors" title={lead.nombre}>{lead.nombre}</p>
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

/* ── widget: Leads por día ───────────────────────────────────────────── */
function TodayLeadsWidget({ leads }: { leads: Lead[] }) {
  function todayGMT5() {
    const d = new Date(); d.setHours(d.getHours() - 5);
    return d.toISOString().substring(0, 10);
  }

  const [selectedDate, setSelectedDate] = useState<string>(todayGMT5);
  const [showModal, setShowModal] = useState(false);
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
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-blue-50 shrink-0"><CalendarCheck2 size={15} className="text-blue-600" /></div>
          <span className="text-sm font-semibold text-slate-700 flex-1">Leads por día</span>
          <button onClick={() => setShowModal(true)} disabled={dayLeads.length === 0} title="Ver tabla de leads"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-30 transition-colors">
            <Eye size={15} />
          </button>
        </div>

        <div className="flex items-center gap-1 mb-1">
          <button onClick={() => shiftDay(-1)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"><ChevronLeft size={14} /></button>
          <input type="date" value={selectedDate} max={todayGMT5()}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <button onClick={() => shiftDay(1)} disabled={isToday}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 transition-colors shrink-0"><ChevronRight size={14} /></button>
        </div>

        <p className="text-xs text-slate-400 capitalize mb-3">{fmtLabel}</p>

        <div className="flex items-end gap-1.5 mb-4">
          <span className="text-4xl font-bold text-slate-800 leading-none">{dayLeads.length}</span>
          <span className="text-xs text-slate-400 mb-1">leads</span>
          {isToday && <span className="ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">hoy</span>}
        </div>

        {sorted.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Sin leads en esta fecha</p>
        ) : (
          <div className="space-y-3">
            {sorted.map(([linea, count], i) => {
              const palette = LINE_PALETTE[i % LINE_PALETTE.length];
              const pct = Math.round((count / max) * 100);
              return (
                <div key={linea}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-600 truncate max-w-[130px]" title={linea}>{linea}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full shrink-0 ${palette.badge}`}>{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${palette.bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RecentLeadsWidget leads={leads} />

      <p className="text-xs text-slate-400 text-center leading-relaxed px-1">Por fecha de creación · todos los registros</p>

      {showModal && <DayLeadsModal leads={dayLeads} date={selectedDate} onClose={() => setShowModal(false)} />}
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
  dateFrom:        string;  // 2. filtro rango fechas
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
    dateFrom: "", dateTo: "",
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

  /* métricas */
  const metrics = useMemo(() => {
    const totalIngresos = filtered.reduce((s, l) => s + (l.ingresosEsperados || 0), 0);
    const lastUpdate    = filtered.reduce((m, l) => (l.ultimaModificacion > m ? l.ultimaModificacion : m), "");
    const ganados       = filtered.filter((l) => l.ganado === "Ganado").length;
    return { totalIngresos, lastUpdate: fmtDate(lastUpdate), ganados };
  }, [filtered]);

  // 4. sparklines — últimos 14 días (sobre todos los leads, no filtrados)
  const sparklines = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(d.getHours() - 5); d.setDate(d.getDate() - (13 - i));
      return d.toISOString().substring(0, 10);
    });
    return {
      leads:   days.map((day) => leads.filter((l) => l.fechaCreacion.startsWith(day)).length),
      ganados: days.map((day) => leads.filter((l) => l.fechaCreacion.startsWith(day) && l.ganado === "Ganado").length),
      ingresos:days.map((day) => leads.filter((l) => l.fechaCreacion.startsWith(day)).reduce((s, l) => s + l.ingresosEsperados, 0)),
    };
  }, [leads]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.comercial       !== "ALL") c++;
    if (filters.linea           !== "ALL") c++;
    if (filters.tipoOportunidad !== "ALL") c++;
    if (filters.equipoVentas    !== "ALL") c++;
    if (filters.preventa        !== "ALL") c++;
    if (filters.activo          !== "ALL") c++;
    if (filters.dateFrom)                  c++;
    if (filters.dateTo)                    c++;
    if (search.trim())                     c++;
    return c;
  }, [filters, search]);

  function clearFilters() {
    setFilters({
      comercial: "ALL", linea: "ALL", tipoOportunidad: "ALL",
      equipoVentas: "ALL", preventa: "ALL", activo: "ALL",
      dateFrom: "", dateTo: "",
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
        className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700">
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

        {/* ── 4. métricas con sparklines ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Last Update",        value: metrics.lastUpdate || "—",                         icon: Clock,      color: "text-slate-600 bg-slate-100",  spark: null },
            { label: "Leads",              value: filtered.length.toLocaleString("es-CO"),            icon: Users,      color: "text-blue-600 bg-blue-50",     spark: { data: sparklines.leads,    color: "bg-blue-400" } },
            { label: "Ganados",            value: metrics.ganados.toLocaleString("es-CO"),            icon: TrendingUp, color: "text-emerald-600 bg-emerald-50",spark: { data: sparklines.ganados,  color: "bg-emerald-400" } },
            { label: "Ingresos Esperados", value: COP(metrics.totalIngresos),                        icon: DollarSign, color: "text-violet-600 bg-violet-50",  spark: { data: sparklines.ingresos, color: "bg-violet-400" } },
          ].map(({ label, value, icon: Icon, color, spark }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color} shrink-0`}><Icon size={18} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
                </div>
              </div>
              {spark && <Sparkline data={spark.data} color={spark.color} />}
            </div>
          ))}
        </div>

        {/* ── barra de filtros ── */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">

          {/* cabecera de filtros */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 leading-none">
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
          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 border-b border-slate-100">
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
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 w-36"
                />
              </div>
              <span className="text-slate-300 mb-2 text-sm leading-none">→</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 w-36"
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
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* botones de acción */}
            <div className="flex items-end gap-2">
              <button
                onClick={loadLeads}
                disabled={loading}
                title="Sincronizar ODOO"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
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

        {/* ── error ── */}
        {error && (
          <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
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
                <div key={h} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse" style={{ height: h }}>
                  <div className="h-3 w-28 bg-slate-200 rounded mb-3" />
                  <div className="space-y-2">
                    <div className="h-2 bg-slate-100 rounded w-full" />
                    <div className="h-2 bg-slate-100 rounded w-3/4" />
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
            <div className="flex-1 min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* info bar */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">
                    {filtered.length} de {leads.length} leads
                    {lastFetch && ` · actualizado ${lastFetch.toLocaleTimeString("es-CO")}`}
                  </span>
                  {/* 7. badge nuevos leads */}
                  {newCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
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
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {(
                        [
                          ["nombre",             "Nombre"],
                          ["cliente",            "Cliente"],
                          ["comercial",          "Comercial"],
                          ["linea",              "Línea"],
                          ["etapa",              "Etapa"],
                          ["tipoOportunidad",    "Tipo Oportunidad"],
                          ["equipoVentas",       "Equipo Ventas"],
                          ["preventa",           "Preventa"],
                          ["etapaPreventa",      "Etapa Preventa"],
                          ["fechaCreacion",      "Fecha Creación"],
                          ["ingresosEsperados",  "Ingresos Esp."],
                          ["consultoriaCOP",     "Consultoría"],
                          ["datosCOP",           "Datos"],
                          ["tiCOP",              "TI"],
                          ["cierreEsperado",     "Cierre Esp."],
                          ["ganado",             "Estado"],
                          ["activo",             "Activo"],
                          ["ultimaModificacion", "Actualizado"],
                        ] as [SortKey, string][]
                      ).map(([key, label], idx) => (
                        <th
                          key={key}
                          onClick={() => toggleSort(key)}
                          className={`text-left px-3 py-2.5 font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 select-none whitespace-nowrap
                            ${idx === 0 ? "sticky left-0 z-20 bg-slate-50 shadow-[1px_0_0_0_#e2e8f0]" : ""}`}
                        >
                          <span className="flex items-center gap-1">{label}<SortIcon col={key} /></span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={18} className="px-4 py-12 text-center text-slate-400 text-sm">
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
                          className={`transition-colors cursor-pointer group ${isNew ? "bg-emerald-50/40 hover:bg-emerald-100/50" : "hover:bg-blue-50/50"}`}
                        >
                          {/* 3. columna Nombre sticky */}
                          <td className={`px-3 py-2.5 sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0] ${
                            isNew ? "bg-emerald-50/40 group-hover:bg-emerald-100/50" : "bg-white group-hover:bg-blue-50/50"
                          }`}>
                            <div className="flex items-start gap-1.5">
                              {/* 7. badge NEW */}
                              {isNew && (
                                <span className="mt-0.5 shrink-0 text-[8px] font-bold px-1 py-px rounded bg-emerald-500 text-white uppercase leading-tight">
                                  NEW
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-slate-800 max-w-[200px] truncate" title={lead.nombre}>{lead.nombre}</p>
                                {lead.correo && <p className="text-slate-400 truncate max-w-[200px]">{lead.correo}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[160px]"><span className="truncate block" title={lead.cliente}>{lead.cliente || "—"}</span></td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{lead.comercial || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            {lead.linea ? <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 font-medium">{lead.linea}</span> : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${ETAPA_STYLE[lead.etapa] ?? "bg-slate-100 text-slate-600"}`}>{lead.etapa || "—"}</span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{lead.tipoOportunidad || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{lead.equipoVentas || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{lead.preventa || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{lead.etapaPreventa || "—"}</td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{lead.fechaCreacion ? lead.fechaCreacion.substring(0, 10) : "—"}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-700 whitespace-nowrap">{lead.ingresosEsperados ? COP(lead.ingresosEsperados) : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">{lead.consultoriaCOP ? COP(lead.consultoriaCOP) : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">{lead.datosCOP ? COP(lead.datosCOP) : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-slate-600 whitespace-nowrap">{lead.tiCOP ? COP(lead.tiCOP) : "—"}</td>
                          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{lead.cierreEsperado || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${WON_STYLE[lead.ganado] ?? "bg-slate-100 text-slate-600"}`}>{lead.ganado}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lead.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
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
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                  <span className="text-xs text-slate-500">
                    {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length} registros
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => goTo(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronsLeft size={14} /></button>
                    <button onClick={() => goTo(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronLeft size={14} /></button>
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
                            className={`min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors ${currentPage === item ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-200"}`}>
                            {item}
                          </button>
                        )
                      )}
                    <button onClick={() => goTo(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronRight size={14} /></button>
                    <button onClick={() => goTo(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 disabled:opacity-30 transition-colors"><ChevronsRight size={14} /></button>
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
