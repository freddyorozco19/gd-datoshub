"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Clock, AlertTriangle } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import type { PresalesTimeline } from "@/lib/odoo/client";
import { personInitials } from "./initials";
import { cyclesFor, median, fmtDays } from "./presalesCycle";

/* Ficha de un preventa: carga actual, rendimiento del año frente al equipo y sus leads abiertos. */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const AVATAR = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500"];
const avatarOf = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
const isInt = (l: Lead) => norm(l.compania || "").includes("international");

export default function PresalesPreventaModal({
  name, roleLabel, active, leads, timeline, year, limit, teamOcup, teamStale, staleDays, daysSince, fmtCOP, fmtUSD,
  blocked, onClose, onOpenLead, onList,
}: {
  name: string;
  roleLabel: string;                         // Profesional, Líder o Gerente
  active: boolean;
  leads: Lead[];                             // todos los leads de Odoo (la ficha filtra los de este preventa)
  timeline: PresalesTimeline | null;
  year: number | "ALL";
  limit: number;                             // máximo de leads abiertos (100 % de ocupación)
  teamOcup: number;                          // ocupación global del equipo (%)
  teamStale: number;                         // estancados promedio por preventa
  staleDays: number;
  daysSince: (l: Lead) => number;
  fmtCOP: (v: number) => string;
  fmtUSD: (v: number) => string;
  blocked: boolean;                          // hay otro popup encima: no cerrar con Esc
  onClose: () => void;
  onOpenLead: (l: Lead) => void;
  onList: (leads: Lead[], heading: string) => void;
}) {
  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, onClose]);

  const d = useMemo(() => {
    const mine = leads.filter((l) => l.preventa === name);
    const open = mine.filter((l) => norm(l.etapaPreventa) === "abierto");
    const stale = open.filter((l) => daysSince(l) > staleDays);
    const ocup = Math.round((open.length / limit) * 100);

    const teamRows = cyclesFor(timeline, leads.filter((l) => !!l.preventa), year);
    const myRows = teamRows.filter((r) => r.lead.preventa === name);
    const myMed = median(myRows.map((r) => r.days));
    const teamMed = median(teamRows.map((r) => r.days));

    // cierres por mes del año elegido (o del año en curso si se miran todos); cada lead cuenta una vez por mes
    const y = year === "ALL" ? new Date().getFullYear() : year;
    const perMonth: Lead[][] = Array.from({ length: 12 }, () => []);
    const byId = new Map(mine.map((l) => [l.id, l]));
    const seen = new Set<string>();
    for (const c of timeline?.closes ?? []) {
      const l = byId.get(c.leadId);
      if (!l || !c.date.startsWith(String(y))) continue;
      const mi = Number(c.date.slice(5, 7)) - 1;
      const key = `${l.id}-${mi}`;
      if (!seen.has(key)) { seen.add(key); perMonth[mi].push(l); }
    }
    const closed = perMonth.reduce((s, a) => s + a.length, 0);
    const pipe = (arr: Lead[]) => {
      const cop = arr.filter((l) => !isInt(l)).reduce((s, l) => s + l.ingresosEsperados, 0);
      const usd = arr.filter(isInt).reduce((s, l) => s + l.ingresosEsperados, 0);
      return `${cop ? fmtCOP(cop) : ""}${cop && usd ? " · " : ""}${usd ? fmtUSD(usd) : ""}` || "—";
    };
    return {
      mine, open, stale, ocup, myMed, teamMed, myCycles: myRows.length, perMonth, closed, y,
      pipeline: pipe(open),
      openSorted: [...open].sort((a, b) => daysSince(b) - daysSince(a)),
    };
  }, [leads, name, timeline, year, limit, staleDays, daysSince, fmtCOP, fmtUSD]);

  const maxMonth = Math.max(1, ...d.perMonth.map((a) => a.length));
  const compare = (label: string, mine: number, team: number, fmt: (v: number) => string, color: string) => {
    const max = Math.max(mine, team, 1);
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-[11px]"><span className="text-slate-400">{label}</span><span className="tabular-nums text-slate-300">{fmt(mine)} <span className="text-slate-500">· equipo {fmt(team)}</span></span></div>
        <div className="relative h-1.5 rounded-full bg-white/[0.08]">
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(mine / max) * 100}%`, backgroundColor: color }} />
          <span className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-slate-300" style={{ left: `${Math.min(100, (team / max) * 100)}%` }} title="Equipo" />
        </div>
      </div>
    );
  };
  const stat = (label: string, value: string, hint?: string, onClick?: () => void) => {
    const inner = (
      <>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
        <p className="text-xl font-semibold tabular-nums text-slate-100 mt-0.5 truncate">{value}</p>
        {hint && <p className="text-[11px] text-slate-500 truncate">{hint}</p>}
      </>
    );
    const cls = "rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 min-w-0 text-left";
    return onClick ? <button type="button" onClick={onClick} className={`${cls} row-hover cursor-pointer`}>{inner}</button> : <div className={cls}>{inner}</div>;
  };

  return createPortal(
    <div className="dashboard-shell">
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        style={{ backgroundColor: "var(--app-modal-overlay)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-panel backdrop-blur-2xl rounded-2xl shadow-2xl shadow-black/60 border border-white/[0.14] w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
          <div className="app-bar modal-header flex items-center justify-between gap-4 px-6 h-[68px] shrink-0 border-b border-white/[0.07]">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${avatarOf(name)}`} aria-hidden>{personInitials(name)}</span>
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-100 uppercase tracking-wide text-sm truncate">{name}</h2>
                <p className="text-[11px] text-slate-400 truncate">Preventa · {roleLabel} · {active ? "Activo" : "Inactivo"}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar" className="p-2 rounded-lg hover:bg-white/[0.12] transition-colors"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stat("Abiertos", String(d.open.length), `de ${limit} · pipeline ${d.pipeline}`, d.open.length ? () => onList(d.open, `${name} · abiertos`) : undefined)}
              {stat("Ocupación", `${d.ocup}%`, `equipo ${teamOcup}%`)}
              {stat(`Cierres ${d.y}`, String(d.closed), `${d.mine.length} leads en total`)}
              {stat("Ciclo mediano", d.myCycles ? fmtDays(d.myMed) : "—", d.teamMed ? `equipo ${fmtDays(d.teamMed)}` : undefined)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-200 mb-2">Cierres por mes · {d.y}</h3>
                <div className="flex items-end gap-1.5 h-[88px]">
                  {d.perMonth.map((arr, i) => (
                    <button key={i} type="button" disabled={arr.length === 0} onClick={() => onList(arr, `${name} · ${MES[i]} ${d.y}`)}
                      title={`${arr.length} cierre${arr.length === 1 ? "" : "s"} en ${MES[i]}`}
                      className="row-hover flex-1 h-full flex flex-col items-center justify-end gap-1 rounded-md pt-1 text-[10px] text-slate-400 disabled:cursor-default cursor-pointer">
                      <span className="tabular-nums text-slate-300">{arr.length || ""}</span>
                      <span className="w-full rounded-t bg-blue-500" style={{ height: `${(arr.length / maxMonth) * 54}px`, minHeight: arr.length ? 3 : 0 }} />
                      <span>{MES[i]}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-200 mb-3">Frente al equipo</h3>
                <div className="space-y-3.5">
                  {compare("Ciclo mediano", d.myMed, d.teamMed, fmtDays, "#378ADD")}
                  {compare("Ocupación", d.ocup, teamOcup, (v) => `${Math.round(v)}%`, "#1D9E75")}
                  {compare("Estancados", d.stale.length, Math.round(teamStale * 10) / 10, (v) => String(v), "#E24B4A")}
                </div>
              </section>
            </div>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-200 mb-2">Sus leads abiertos <span className="font-normal text-slate-500 normal-case tracking-normal">· los de más tiempo sin cambios primero</span></h3>
              {d.openSorted.length === 0 ? <p className="text-xs text-slate-500 py-3">No tiene leads abiertos</p> : (
                <div className="divide-y divide-white/[0.05]">
                  {d.openSorted.map((l) => {
                    const days = daysSince(l);
                    const stale = days > staleDays;
                    return (
                      <button key={l.id} type="button" onClick={() => onOpenLead(l)} className="row-hover w-full flex items-center gap-3 text-left px-2 py-2 rounded-lg cursor-pointer">
                        <span className="shrink-0 text-[10px] font-mono font-bold text-slate-400">#{l.id}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-semibold text-slate-100 truncate" title={l.nombre}>{l.nombre}</span>
                          <span className="block text-[11px] text-slate-500 truncate">{l.cliente || "—"}{l.cierreEsperado ? ` · cierre ${l.cierreEsperado.substring(0, 10)}` : ""}</span>
                        </span>
                        <span className="shrink-0 text-[11px] tabular-nums text-slate-300">{l.ingresosEsperados ? (isInt(l) ? fmtUSD(l.ingresosEsperados) : fmtCOP(l.ingresosEsperados)) : "—"}</span>
                        <span className={`shrink-0 flex items-center gap-1 text-[11px] tabular-nums ${stale ? "text-rose-500 font-semibold" : "text-slate-400"}`}>
                          {stale ? <AlertTriangle size={11} /> : <Clock size={11} />} {days} d
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
