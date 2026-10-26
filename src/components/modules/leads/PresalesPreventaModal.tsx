"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, Clock, AlertTriangle } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import type { PresalesTimeline } from "@/lib/odoo/client";
import { personInitials } from "./initials";
import InfoTip from "@/components/ui/InfoTip";
import { cyclesFor, median, fmtDays } from "./presalesCycle";

/* Ficha de un preventa: carga actual, rendimiento del año frente al equipo y sus leads abiertos. */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const AVATAR = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500"];
const avatarOf = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
const isInt = (l: Lead) => norm(l.compania || "").includes("international");

export default function PresalesPreventaModal({
  name, roleLabel, active, leads, timeline, year, limit, teamOcup, teamStale, peers, staleDays, daysSince, fmtCOP, fmtUSD,
  blocked, onClose, onOpenLead, onList, onOpenPreventa,
}: {
  name: string;
  roleLabel: string;                         // Profesional, Líder o Gerente
  active: boolean;
  leads: Lead[];                             // todos los leads de Odoo (la ficha filtra los de este preventa)
  timeline: PresalesTimeline | null;
  year: number | "ALL";
  limit: number;                             // máximo de leads abiertos (100 % de ocupación)
  teamOcup: number;                          // ocupación global del equipo (%): la misma de la card Ocupación, así que sigue los filtros de la página
  teamStale: number;                         // estancados promedio por preventa (mismo criterio)
  peers: { name: string; open: number; stale: number }[];   // equipo de referencia (preventas Profesionales) tal como lo muestra la tabla de carga
  staleDays: number;
  daysSince: (l: Lead) => number;
  fmtCOP: (v: number) => string;
  fmtUSD: (v: number) => string;
  blocked: boolean;                          // hay otro popup encima: no cerrar con Esc
  onClose: () => void;
  onOpenLead: (l: Lead) => void;
  onList: (leads: Lead[], heading: string) => void;
  onOpenPreventa?: (name: string) => void;   // abrir la ficha de otro preventa desde un punto del strip plot
}) {
  useEffect(() => {
    if (blocked) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, onClose]);

  const d = useMemo(() => {
    const mine = leads.filter((l) => l.preventa === name);
    // carga real: Estado Preventa ABIERTO y lead activo (un lead archivado/perdido no ocupa al preventa aunque su estado siga en ABIERTO)
    const isOpenLoad = (l: Lead) => norm(l.etapaPreventa) === "abierto" && l.activo;
    const open = mine.filter(isOpenLoad);
    const stale = open.filter((l) => daysSince(l) > staleDays);
    const ocup = Math.round((open.length / limit) * 100);

    const teamRows = cyclesFor(timeline, leads.filter((l) => !!l.preventa), year);
    const myRows = teamRows.filter((r) => r.lead.preventa === name);
    const myMed = median(myRows.map((r) => r.days));
    const teamMed = median(teamRows.map((r) => r.days));
    // un punto por preventa del equipo (sin esta ficha) en cada métrica
    const peerNames = new Set(peers.map((p) => p.name));
    const cycByPeer = new Map<string, number[]>();
    for (const r of teamRows) { if (peerNames.has(r.lead.preventa)) cycByPeer.set(r.lead.preventa, [...(cycByPeer.get(r.lead.preventa) ?? []), r.days]); }
    const dotsCiclo = [...cycByPeer.entries()].filter(([n]) => n !== name).map(([n, ds]) => ({ name: n, v: median(ds) }));
    const dotsOcup = peers.filter((p) => p.name !== name).map((p) => ({ name: p.name, v: Math.round((p.open / limit) * 100) }));
    const dotsStale = peers.filter((p) => p.name !== name).map((p) => ({ name: p.name, v: p.stale }));

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
      mine, open, stale, ocup, myMed, teamMed, dotsCiclo, dotsOcup, dotsStale, myCycles: myRows.length, perMonth, closed, y,
      pipeline: pipe(open),
      openSorted: [...open].sort((a, b) => daysSince(b) - daysSince(a)),
    };
  }, [leads, name, timeline, year, limit, peers, staleDays, daysSince, fmtCOP, fmtUSD]);

  const maxMonth = Math.max(1, ...d.perMonth.map((a) => a.length));
  /* Frente al equipo: un strip plot por métrica. Cada punto gris es un preventa del equipo (clic abre su ficha); el punto de color es
     esta ficha y la línea punteada, la referencia del equipo. El color indica si va mejor o peor (en ocupación es informativo). */
  const strip = (label: string, mine: number, team: number, dots: { name: string; v: number }[], fmt: (v: number) => string, opts: { percent?: boolean; lowerIsBetter?: boolean }) => {
    const W = 640, PAD = 10, AX = 46;
    const top = Math.max(mine, team, ...dots.map((x) => x.v), 1) * 1.08;
    const raw = (opts.percent ? Math.max(100, top) : top) / 4;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow;
    const max = step * 4;
    const x = (v: number) => PAD + (Math.min(v, max) / max) * (W - 2 * PAD);
    let color = "#378ADD";
    if (opts.lowerIsBetter) color = mine <= team ? "#1D9E75" : mine <= team * 1.5 ? "#EF9F27" : "#E24B4A";
    const placed: [number, number][] = [];
    const pts = dots.map((p) => {
      const h = [...p.name].reduce((s, c) => s + c.charCodeAt(0), 0);
      let cy = 30, k = 0;
      const base = (h % 7) - 3;
      while (k < 14 && placed.some(([px, py]) => Math.hypot(px - x(p.v), py - cy) < 9)) { cy = 30 + (((k % 2 ? 1 : -1) * (Math.floor(k / 2) + 1) * 5) + base * 0.5); k++; }
      cy = Math.min(40, Math.max(14, cy));
      placed.push([x(p.v), cy]);
      return { ...p, cy };
    });
    return (
      <div>
        <div className="flex justify-between text-[11px] mb-1"><span className="text-slate-400">{label}</span><span className="tabular-nums text-slate-300">{fmt(mine)} <span className="text-slate-500">· equipo {fmt(team)}</span></span></div>
        <svg viewBox={`0 0 ${W} 66`} className="w-full h-auto block" role="img" aria-label={`${label}: ${fmt(mine)} frente a ${fmt(team)} del equipo`}>
          <line x1={PAD} y1={AX} x2={W - PAD} y2={AX} stroke="currentColor" strokeOpacity={0.18} />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={x(step * i)} y1={AX - 3} x2={x(step * i)} y2={AX + 3} stroke="currentColor" strokeOpacity={0.25} />
              <text x={x(step * i)} y={AX + 16} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.5}>{fmt(step * i)}</text>
            </g>
          ))}
          <line x1={x(team)} y1={6} x2={x(team)} y2={AX} stroke="currentColor" strokeOpacity={0.6} strokeWidth={2} strokeDasharray="3 3"><title>{`Equipo: ${fmt(team)}`}</title></line>
          {pts.map((p) => (
            <circle key={p.name} cx={x(p.v)} cy={p.cy} r={5} fill="currentColor" fillOpacity={0.4} className={onOpenPreventa ? "cursor-pointer hover:fill-opacity-80" : undefined}
              onClick={onOpenPreventa ? () => onOpenPreventa(p.name) : undefined}><title>{`${p.name}: ${fmt(p.v)}`}</title></circle>
          ))}
          <circle cx={x(mine)} cy={30} r={10} fill={color} fillOpacity={0.25} />
          <circle cx={x(mine)} cy={30} r={6} fill={color} stroke="var(--surface-1)" strokeWidth={1.5}><title>{`${name}: ${fmt(mine)}`}</title></circle>
        </svg>
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
                      className="row-hover flex-1 h-full flex flex-col items-center justify-end gap-1 rounded-md pt-1 text-[11px] text-slate-400 disabled:cursor-default cursor-pointer">
                      <span className="tabular-nums text-slate-300">{arr.length || ""}</span>
                      <span className="w-full rounded-t bg-blue-500" style={{ height: `${(arr.length / maxMonth) * 54}px`, minHeight: arr.length ? 3 : 0 }} />
                      <span>{MES[i]}</span>
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-200 mb-3">
                  Frente al equipo
                  <InfoTip
                    rule="Cada punto gris es un preventa del equipo y el punto de color es esta ficha. La línea punteada es la referencia del equipo. Un clic en un punto gris abre la ficha de ese preventa."
                    note="La referencia del equipo es la misma de la tabla y la card de Ocupación, así que sigue los filtros de la página. En ciclo y estancados el color indica si va mejor (verde) o peor (ámbar o rojo) que el equipo."
                    fields={["Estado Preventa (x_studio_edopreventa)", "x_studio_preventa", "historial de etapas"]}
                  />
                </h3>
                <div className="space-y-4">
                  {strip("Ciclo mediano", d.myMed, d.teamMed, d.dotsCiclo, fmtDays, { lowerIsBetter: true })}
                  {strip("Ocupación", d.ocup, teamOcup, d.dotsOcup, (v) => `${Math.round(v)}%`, { percent: true })}
                  {strip("Estancados", d.stale.length, Math.round(teamStale * 10) / 10, d.dotsStale, (v) => v.toLocaleString("es-CO", { maximumFractionDigits: 1 }), { lowerIsBetter: true })}
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
                        <span className="shrink-0 text-[11px] font-mono font-bold text-slate-400">#{l.id}</span>
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
