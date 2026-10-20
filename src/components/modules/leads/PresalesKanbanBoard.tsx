"use client";

import { useMemo, useRef, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Clock, AlertTriangle, CircleDot, CircleCheck, CirclePause, Ban, CircleX, Circle, type LucideIcon } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import FitRow from "./FitRow";
import { uniqueEtapaActual } from "./etapaOrder";

/* Kanban de Estado Preventa (solo lectura), incrustado en el panel de Cambios recientes: una columna por estado, scroll horizontal
   entre columnas y vertical dentro de cada una. Un clic en una tarjeta abre el detalle del lead. */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isInt = (l: Lead) => norm(l.compania || "").includes("international");

// orden y color de las columnas conocidas; cualquier otro valor de Odoo se agrega al final
// tone: velo de color (vidrio) de la columna; Icon: icono junto al título (ver .kb-col en globals.css)
type Tone = "blue" | "green" | "amber" | "rose" | "slate";
const KNOWN: { key: string; label: string; tone: Tone; Icon: LucideIcon }[] = [
  { key: "abierto",          label: "ABIERTO",          tone: "blue",  Icon: CircleDot },
  { key: "cerrado",          label: "CERRADO",          tone: "green", Icon: CircleCheck },
  { key: "suspendida",       label: "SUSPENDIDA",       tone: "amber", Icon: CirclePause },
  { key: "oferta no viable", label: "OFERTA NO VIABLE", tone: "rose",  Icon: Ban },
  { key: "oferta declinada", label: "OFERTA DECLINADA", tone: "slate", Icon: CircleX },
];
const NONE = "__none__";   // leads sin preventa
const lbl = "text-[10px] font-semibold uppercase tracking-wide text-slate-500 text-center whitespace-nowrap";
const inputCls = "rounded-lg bg-white/[0.04] border border-white/[0.1] px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60";
const AVATAR = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-cyan-500", "bg-orange-500"];
const avatarOf = (name: string) => AVATAR[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR.length];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export default function PresalesKanbanBoard({
  leads, staleDays, daysSince, fmtCOP, fmtUSD, onOpenLead,
}: {
  leads: Lead[];
  staleDays: number;                       // días sin cambios para marcar un lead como estancado
  daysSince: (l: Lead) => number;
  fmtCOP: (v: number) => string;
  fmtUSD: (v: number) => string;
  onOpenLead: (l: Lead) => void;
}) {
  const [q, setQ] = useState("");
  const [fPrev, setFPrev] = useState("ALL");
  const [fLin, setFLin] = useState("ALL");
  const [fEtapa, setFEtapa] = useState("ALL");   // Etapa actual (x_studio_etapa_actual)
  const [fComp, setFComp] = useState<"ALL" | "SAS" | "INT">("ALL");
  const prevOpts = useMemo(() => Array.from(new Set(leads.map((l) => l.preventa).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")), [leads]);
  const hasNoPrev = useMemo(() => leads.some((l) => !l.preventa), [leads]);
  const linOpts = useMemo(() => Array.from(new Set(leads.map((l) => l.linea).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")), [leads]);
  const etapaOpts = useMemo(() => uniqueEtapaActual(leads.map((l) => l.etapa)).filter((v) => v !== "ALL"), [leads]);
  const hasNoEtapa = useMemo(() => leads.some((l) => !l.etapa), [leads]);
  const filtering = !!q.trim() || fPrev !== "ALL" || fLin !== "ALL" || fEtapa !== "ALL" || fComp !== "ALL";
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);

  const columns = useMemo(() => {
    const nq = norm(q.trim());
    const match = (l: Lead) =>
      (!nq || norm(`${l.id} ${l.nombre} ${l.cliente} ${l.preventa} ${l.linea}`).includes(nq)) &&
      (fPrev === "ALL" || (fPrev === NONE ? !l.preventa : l.preventa === fPrev)) &&
      (fLin === "ALL" || l.linea === fLin) &&
      (fEtapa === "ALL" || (fEtapa === NONE ? !l.etapa : l.etapa === fEtapa)) &&
      (fComp === "ALL" || (fComp === "INT" ? isInt(l) : !isInt(l)));
    const byKey = new Map<string, { key: string; label: string; tone: Tone; Icon: LucideIcon; all: Lead[] }>();
    for (const k of KNOWN) byKey.set(k.key, { ...k, all: [] });
    for (const l of leads) {
      const raw = (l.etapaPreventa || "").trim();
      const key = raw ? norm(raw) : "";
      if (!byKey.has(key)) byKey.set(key, { key, label: raw ? raw.toUpperCase() : "SIN ESTADO", tone: "slate", Icon: Circle, all: [] });
      byKey.get(key)!.all.push(l);
    }
    return [...byKey.values()]
      .filter((c) => c.all.length > 0 || KNOWN.some((k) => k.key === c.key))
      .map((c) => {
        const shown = c.all.filter(match).sort((a, b) => b.ultimaModificacion.localeCompare(a.ultimaModificacion));
        const sum = (arr: Lead[]) => arr.reduce((s, l) => s + l.ingresosEsperados, 0);
        return { ...c, shown, cop: sum(c.all.filter((l) => !isInt(l))), usd: sum(c.all.filter(isInt)) };
      });
  }, [leads, q, fPrev, fLin, fEtapa, fComp]);

  const scrollBoard = (dx: number) => boardRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="flex flex-col" style={{ height: "clamp(420px, 68vh, 760px)" }}>
      <div className="shrink-0 pb-3">
        <FitRow
          left={<>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Preventa</span>
              <select value={fPrev} onChange={(e) => setFPrev(e.target.value)} aria-label="Filtrar por preventa" className={`cmmi-select ${inputCls} w-60`}>
                <option value="ALL">Todos</option>
                {prevOpts.map((p) => <option key={p} value={p}>{p}</option>)}
                {hasNoPrev && <option value={NONE}>Sin preventa</option>}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Línea</span>
              <select value={fLin} onChange={(e) => setFLin(e.target.value)} aria-label="Filtrar por línea" className={`cmmi-select ${inputCls} w-60`}>
                <option value="ALL">Todas</option>
                {linOpts.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Etapa actual</span>
              <select value={fEtapa} onChange={(e) => setFEtapa(e.target.value)} aria-label="Filtrar por etapa actual" className={`cmmi-select ${inputCls} w-52`}>
                <option value="ALL">Todas</option>
                {etapaOpts.map((p) => <option key={p} value={p}>{p}</option>)}
                {hasNoEtapa && <option value={NONE}>Sin etapa</option>}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Compañía</span>
              <select value={fComp} onChange={(e) => setFComp(e.target.value as "ALL" | "SAS" | "INT")} aria-label="Filtrar por compañía" className={`cmmi-select ${inputCls} w-56`}>
                <option value="ALL">Todas</option>
                <option value="SAS">GROW DATA</option>
                <option value="INT">GROW DATA INTERNATIONAL</option>
              </select>
            </div>
          </>}
          right={
            <div className="flex flex-col gap-1">
              <span className={lbl}>Búsqueda</span>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ID, lead, cliente, preventa…" aria-label="Buscar en el kanban" className={`${inputCls} pl-8 w-60`} />
              </div>
            </div>
          }
        />
      </div>

          <div className="relative flex-1 min-h-0">
            <button type="button" onClick={() => scrollBoard(-340)} aria-label="Estados anteriores"
              className="pill-option absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full border shadow-lg"><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => scrollBoard(340)} aria-label="Estados siguientes"
              className="pill-option absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full border shadow-lg"><ChevronRight size={16} /></button>

            <div ref={boardRef}
              className="h-full overflow-x-auto overflow-y-hidden flex gap-4 pb-2 cursor-grab active:cursor-grabbing select-none"
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest("button,input,a")) return;
                drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => { const d = drag.current; if (d) e.currentTarget.scrollLeft = d.left - (e.clientX - d.x); }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}>
              {columns.map((c) => (
                <section key={c.key || "none"} data-tone={c.tone} className="kb-col w-[300px] shrink-0 h-full flex flex-col rounded-2xl overflow-hidden">
                  <header className="shrink-0 px-3.5 pt-3 pb-2.5 border-b border-white/[0.08]">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-100 min-w-0"><c.Icon size={15} className="kb-ic shrink-0" aria-hidden /><span className="truncate">{c.label}</span></h3>
                      <span className="text-xs tabular-nums text-slate-300">{filtering ? `${c.shown.length} de ${c.all.length}` : c.all.length}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums truncate">
                      {c.cop ? fmtCOP(c.cop) : ""}{c.cop && c.usd ? " · " : ""}{c.usd ? fmtUSD(c.usd) : ""}{!c.cop && !c.usd ? "Sin pipeline" : ""}
                    </p>
                  </header>

                  <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
                    {c.shown.length === 0 && <p className="text-[11px] text-slate-500 text-center py-6">Sin leads</p>}
                    {c.shown.map((l) => {
                      const days = daysSince(l);
                      const stale = days > staleDays;
                      return (
                        <button key={l.id} type="button" onClick={() => onOpenLead(l)}
                          className="kb-card row-hover w-full h-[100px] shrink-0 flex flex-col justify-between text-left rounded-lg px-3 py-2 cursor-pointer overflow-hidden">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-300">#{l.id}</span>
                            <span className="flex items-center gap-2 text-[10px]">
                              {!l.activo && <span className="px-1.5 py-0.5 rounded-full bg-white/[0.08] text-slate-400">Archivado</span>}
                              <span className={`flex items-center gap-1 tabular-nums ${stale ? "text-rose-500 font-semibold" : "text-slate-500"}`}
                                title={`${days} d sin cambios${stale ? " · estancado" : ""}`}>
                                {stale ? <AlertTriangle size={10} /> : <Clock size={10} />}
                                {days} d
                              </span>
                              <i className={`w-2 h-2 rounded-sm ${isInt(l) ? "bg-teal-400" : "bg-blue-400"}`} title={isInt(l) ? "GD INTERNATIONAL" : "GROW DATA"} />
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-100 leading-snug truncate" title={l.nombre}>{l.nombre}</p>
                          <p className="text-[11px] text-slate-400 leading-snug truncate" title={[l.cliente, l.linea].filter(Boolean).join(" · ")}>
                            {l.cliente || "—"}{l.linea && <span className="text-slate-500"> · {l.linea}</span>}
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              {l.preventa ? (
                                <>
                                  <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${avatarOf(l.preventa)}`} aria-hidden>{initials(l.preventa)}</span>
                                  <span className="text-[10px] text-slate-300 truncate" title={l.preventa}>{l.preventa}</span>
                                </>
                              ) : <span className="text-[10px] text-amber-500">Sin preventa</span>}
                            </span>
                            <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-200">
                              {l.ingresosEsperados ? (isInt(l) ? fmtUSD(l.ingresosEsperados) : fmtCOP(l.ingresosEsperados)) : "—"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
    </div>
  );
}
