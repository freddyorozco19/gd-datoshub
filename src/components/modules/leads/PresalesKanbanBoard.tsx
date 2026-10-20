"use client";

import { useMemo, useRef, useState } from "react";
import { Search, ChevronLeft, ChevronRight, Clock, AlertTriangle } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";

/* Kanban de Estado Preventa (solo lectura), incrustado en el panel de Cambios recientes: una columna por estado, scroll horizontal
   entre columnas y vertical dentro de cada una. Un clic en una tarjeta abre el detalle del lead. */

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const isInt = (l: Lead) => norm(l.compania || "").includes("international");

// orden y color de las columnas conocidas; cualquier otro valor de Odoo se agrega al final
const KNOWN: { key: string; label: string; bar: string }[] = [
  { key: "abierto",          label: "ABIERTO",          bar: "bg-blue-500" },
  { key: "cerrado",          label: "CERRADO",          bar: "bg-emerald-500" },
  { key: "suspendida",       label: "SUSPENDIDA",       bar: "bg-amber-500" },
  { key: "oferta no viable", label: "OFERTA NO VIABLE", bar: "bg-rose-500" },
  { key: "oferta declinada", label: "OFERTA DECLINADA", bar: "bg-slate-500" },
];
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
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number } | null>(null);

  const columns = useMemo(() => {
    const nq = norm(q.trim());
    const match = (l: Lead) => !nq || norm(`${l.id} ${l.nombre} ${l.cliente} ${l.preventa} ${l.linea}`).includes(nq);
    const byKey = new Map<string, { key: string; label: string; bar: string; all: Lead[] }>();
    for (const k of KNOWN) byKey.set(k.key, { ...k, all: [] });
    for (const l of leads) {
      const raw = (l.etapaPreventa || "").trim();
      const key = raw ? norm(raw) : "";
      if (!byKey.has(key)) byKey.set(key, { key, label: raw ? raw.toUpperCase() : "SIN ESTADO", bar: "bg-slate-400", all: [] });
      byKey.get(key)!.all.push(l);
    }
    return [...byKey.values()]
      .filter((c) => c.all.length > 0 || KNOWN.some((k) => k.key === c.key))
      .map((c) => {
        const shown = c.all.filter(match).sort((a, b) => b.ultimaModificacion.localeCompare(a.ultimaModificacion));
        const sum = (arr: Lead[]) => arr.reduce((s, l) => s + l.ingresosEsperados, 0);
        return { ...c, shown, cop: sum(c.all.filter((l) => !isInt(l))), usd: sum(c.all.filter(isInt)) };
      });
  }, [leads, q]);

  const scrollBoard = (dx: number) => boardRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <div className="flex flex-col" style={{ height: "clamp(420px, 68vh, 760px)" }}>
      <div className="shrink-0 flex items-center justify-between gap-3 pb-3">
        <p className="text-[11px] text-slate-500 truncate">{leads.length} leads · desplázate o usa las flechas para recorrer los estados</p>
        <div className="relative shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ID, lead, cliente, preventa…" aria-label="Buscar en el kanban"
            className="w-64 rounded-lg bg-white/[0.04] border border-white/[0.1] pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60" />
        </div>
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
                <section key={c.key || "none"} className="w-[300px] shrink-0 h-full flex flex-col rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                  <header className="shrink-0 px-3.5 pt-3 pb-2.5 border-b border-white/[0.08]">
                    <div className={`h-1 rounded-full mb-2.5 ${c.bar}`} />
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-100 truncate">{c.label}</h3>
                      <span className="text-xs tabular-nums text-slate-300">{q.trim() ? `${c.shown.length} de ${c.all.length}` : c.all.length}</span>
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
                          className="row-hover w-full text-left rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 cursor-pointer">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-300">#{l.id}</span>
                            <span className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <i className={`w-2 h-2 rounded-sm ${isInt(l) ? "bg-teal-400" : "bg-blue-400"}`} title={isInt(l) ? "GD INTERNATIONAL" : "GROW DATA"} />
                              {!l.activo && <span className="px-1.5 py-0.5 rounded-full bg-white/[0.08] text-slate-400">Archivado</span>}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-100 mt-1 leading-snug line-clamp-2" title={l.nombre}>{l.nombre}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={l.cliente}>{l.cliente || "—"}</p>
                          {l.linea && <p className="text-[10px] text-slate-500 mt-1 truncate" title={l.linea}>{l.linea}</p>}
                          <div className="flex items-center justify-between gap-2 mt-2.5">
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
                          <p className={`flex items-center gap-1 text-[10px] mt-2 ${stale ? "text-rose-500 font-semibold" : "text-slate-500"}`}>
                            {stale ? <AlertTriangle size={10} /> : <Clock size={10} />}
                            {days} d sin cambios{stale ? " · estancado" : ""}
                          </p>
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
