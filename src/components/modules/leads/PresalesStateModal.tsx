"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, Clock, AlertTriangle, type LucideIcon } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";

/* Detalle de una columna del tablero de Estado Preventa: indicadores, desglose por preventa, línea y compañía,
   y los leads con más tiempo sin cambios. El color y el icono son los del estado (ver .kb-tone en globals.css). */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isInt = (l: Lead) => norm(l.compania || "").includes("international");
const sum = (arr: Lead[]) => arr.reduce((s, l) => s + l.ingresosEsperados, 0);

export default function PresalesStateModal({
  label, tone, Icon, leads, boardTotal, staleDays, daysSince, fmtCOP, fmtUSD, blocked, onClose, onList, onOpenLead,
}: {
  label: string;
  tone: string;                              // blue | green | amber | rose | slate
  Icon: LucideIcon;
  leads: Lead[];                             // todos los leads de la columna
  boardTotal: number;                        // leads de todo el tablero (para el porcentaje)
  staleDays: number;
  daysSince: (l: Lead) => number;
  fmtCOP: (v: number) => string;
  fmtUSD: (v: number) => string;
  blocked: boolean;                          // hay otro popup encima: no cerrar con Esc
  onClose: () => void;
  onList: (leads: Lead[], heading: string) => void;
  onOpenLead: (l: Lead) => void;
}) {
  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, onClose]);

  const d = useMemo(() => {
    const total = leads.length;
    const pct = (n: number, base: number) => (base ? Math.round((n / base) * 100) : 0);
    const sas = leads.filter((l) => !isInt(l));
    const int = leads.filter(isInt);
    const stale = leads.filter((l) => daysSince(l) > staleDays);
    const sinPrev = leads.filter((l) => !l.preventa);
    const archived = leads.filter((l) => !l.activo);
    const avgDays = total ? Math.round(leads.reduce((s, l) => s + daysSince(l), 0) / total) : 0;
    const group = (key: (l: Lead) => string) => {
      const m = new Map<string, Lead[]>();
      for (const l of leads) { const k = key(l); m.set(k, [...(m.get(k) ?? []), l]); }
      return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
    };
    return {
      total, pct, sas, int, stale, sinPrev, archived, avgDays,
      byPrev: group((l) => l.preventa || "Sin preventa"),
      byLinea: group((l) => l.linea || "Sin línea"),
      oldest: [...leads].sort((a, b) => daysSince(b) - daysSince(a)).slice(0, 6),
    };
  }, [leads, staleDays, daysSince]);

  const money = (arr: Lead[]) => {
    const cop = sum(arr.filter((l) => !isInt(l))), usd = sum(arr.filter(isInt));
    return `${cop ? fmtCOP(cop) : ""}${cop && usd ? " · " : ""}${usd ? fmtUSD(usd) : ""}` || "—";
  };

  const stat = (title: string, value: ReactNode, hint?: string, onClick?: () => void) => {
    const inner = (
      <>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{title}</p>
        <p className="text-xl font-semibold tabular-nums text-slate-100 mt-0.5 truncate">{value}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{hint}</p>}
      </>
    );
    const cls = "rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 min-w-0 text-left";
    return onClick
      ? <button type="button" onClick={onClick} className={`${cls} row-hover cursor-pointer`}>{inner}</button>
      : <div className={cls}>{inner}</div>;
  };

  const bars = (rows: [string, Lead[]][], max: number) => (
    <div className="space-y-1">
      {rows.map(([name, arr]) => (
        <button key={name} type="button" onClick={() => onList(arr, `${label} · ${name}`)}
          className="row-hover w-full text-left flex items-center gap-3 text-xs rounded-lg px-2 py-1.5 cursor-pointer">
          <span className="w-44 shrink-0 truncate font-medium text-slate-200" title={name}>{name}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${max ? (arr.length / max) * 100 : 0}%`, backgroundColor: "rgb(var(--kb))" }} />
          </div>
          <span className="w-10 shrink-0 text-right tabular-nums text-slate-300">{arr.length}</span>
          <span className="w-28 shrink-0 text-right tabular-nums text-slate-500 truncate hidden sm:block">{money(arr)}</span>
        </button>
      ))}
    </div>
  );

  const title = (t: string, hint?: string) => (
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-200">{t}</h3>
      {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
    </div>
  );

  const prevRows = d.byPrev.slice(0, 8);
  const compRows: [string, Lead[]][] = [["GROW DATA", d.sas], ["GD INTERNATIONAL", d.int]];

  return createPortal(
    <div className="dashboard-shell">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ backgroundColor: "var(--app-modal-overlay)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div data-tone={tone} className="kb-tone modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.14] w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
          <div className="app-bar modal-header kb-modal-head flex items-center justify-between gap-4 px-6 h-[68px] shrink-0 border-b border-white/[0.07]">
            <div className="flex items-center gap-3 min-w-0">
              <span className="kb-badge shrink-0 w-10 h-10 rounded-full flex items-center justify-center"><Icon size={20} className="kb-ic" aria-hidden /></span>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-100 uppercase tracking-wide text-sm truncate">{label}</h2>
                <p className="text-[11px] text-slate-400 truncate">Estado preventa · {d.total} leads ({d.pct(d.total, boardTotal)} % del tablero)</p>
              </div>
            </div>
            <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar" className="p-2 rounded-lg hover:bg-white/[0.12] transition-colors"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stat("Leads", d.total, `${d.pct(d.total, boardTotal)} % del tablero`, () => onList(leads, label))}
              {stat("Pipeline", money(leads), "COP y USD por separado")}
              {stat("Estancados", d.stale.length, `${d.pct(d.stale.length, d.total)} % · más de ${staleDays} d sin cambios`, d.stale.length ? () => onList(d.stale, `${label} · estancados`) : undefined)}
              {stat("Sin preventa", d.sinPrev.length, `${d.pct(d.sinPrev.length, d.total)} % de la columna`, d.sinPrev.length ? () => onList(d.sinPrev, `${label} · sin preventa`) : undefined)}
              {stat("Sin cambios (promedio)", `${d.avgDays} d`, "días desde la última modificación")}
              {stat("Archivados", d.archived.length, "marcados como inactivos en Odoo", d.archived.length ? () => onList(d.archived, `${label} · archivados`) : undefined)}
            </div>

            <section>
              {title("Por preventa", d.byPrev.length > prevRows.length ? `Top ${prevRows.length} de ${d.byPrev.length}` : "Clic para ver sus leads")}
              {bars(prevRows, prevRows[0]?.[1].length ?? 0)}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section>
                {title("Por línea")}
                {bars(d.byLinea.slice(0, 6), d.byLinea[0]?.[1].length ?? 0)}
              </section>
              <section>
                {title("Por compañía")}
                {bars(compRows, Math.max(d.sas.length, d.int.length))}
              </section>
            </div>

            <section>
              {title("Con más tiempo sin cambios", "Clic para abrir el lead")}
              <div className="divide-y divide-white/[0.05]">
                {d.oldest.map((l) => {
                  const days = daysSince(l);
                  const stale = days > staleDays;
                  return (
                    <button key={l.id} type="button" onClick={() => onOpenLead(l)}
                      className="row-hover w-full flex items-center gap-3 text-left px-2 py-2 rounded-lg cursor-pointer">
                      <span className="shrink-0 text-[11px] font-mono font-bold text-slate-400">#{l.id}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-slate-100 truncate" title={l.nombre}>{l.nombre}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{l.cliente || "—"}{l.preventa ? ` · ${l.preventa}` : ""}</span>
                      </span>
                      <span className={`shrink-0 flex items-center gap-1 text-[11px] tabular-nums ${stale ? "text-rose-500 font-semibold" : "text-slate-400"}`}>
                        {stale ? <AlertTriangle size={11} /> : <Clock size={11} />} {days} d
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
