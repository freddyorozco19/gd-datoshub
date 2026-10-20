"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import type { PresalesTimeline } from "@/lib/odoo/client";
import { BUCKETS, bucketOf, cyclesFor, avg, median, fmtDays } from "./presalesCycle";

/* Tiempo de ciclo en Preventa: cuántos días pasan entre que un lead pasa a ABIERTO y pasa a CERRADO. */

const SIN = "Sin preventa";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function PresalesCycleCard({
  timeline, error, scope, year, onList, onOpenPreventa,
}: {
  timeline: PresalesTimeline | null;
  error: string | null;
  scope: Lead[];                                  // leads que respetan los filtros de la página
  year: number | "ALL";
  onList: (leads: Lead[], heading: string) => void;
  onOpenPreventa: (name: string) => void;
}) {
  const d = useMemo(() => {
    const rows = cyclesFor(timeline, scope, year);
    const days = rows.map((r) => r.days);
    const bucketLeads = new Map<string, Map<number, Lead>>();
    const byPrev = new Map<string, { days: number[]; leads: Map<number, Lead> }>();
    for (const r of rows) {
      const b = bucketOf(r.days);
      if (!bucketLeads.has(b)) bucketLeads.set(b, new Map());
      bucketLeads.get(b)!.set(r.lead.id, r.lead);
      const k = r.lead.preventa || SIN;
      const e: { days: number[]; leads: Map<number, Lead> } = byPrev.get(k) ?? { days: [], leads: new Map() };
      e.days.push(r.days); e.leads.set(r.lead.id, r.lead);
      byPrev.set(k, e);
    }
    const buckets = BUCKETS.map((b) => ({ key: b.key, n: rows.filter((r) => bucketOf(r.days) === b.key).length, leads: [...(bucketLeads.get(b.key)?.values() ?? [])] }));
    const people = [...byPrev.entries()]
      .map(([name, e]) => ({ name, n: e.days.length, avg: avg(e.days), med: median(e.days), leads: [...e.leads.values()] }))
      .sort((a, b) => b.n - a.n);
    return { n: rows.length, avg: avg(days), med: median(days), buckets, people, open: scope.filter((l) => norm(l.etapaPreventa) === "abierto").length };
  }, [timeline, scope, year]);

  if (error) return <p className="text-xs text-rose-500 text-center py-8">{error}</p>;
  if (!timeline) return <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Cargando historial…</div>;

  const maxBucket = Math.max(1, ...d.buckets.map((b) => b.n));
  const maxAvg = Math.max(30, ...d.people.map((p) => p.avg));
  const tone = (v: number) => (v > 45 ? "#E24B4A" : v > 30 ? "#EF9F27" : "#378ADD");

  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-100 truncate">{value}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stat("Promedio", d.n ? fmtDays(d.avg) : "—")}
        {stat("Mediana", d.n ? fmtDays(d.med) : "—")}
        {stat(year === "ALL" ? "Ciclos cerrados" : `Ciclos cerrados ${year}`, d.n.toLocaleString("es-CO"))}
        {stat("Abiertos hoy", d.open.toLocaleString("es-CO"))}
      </div>

      {d.n === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">No hay ciclos cerrados con estos filtros{year === "ALL" ? "" : ` en ${year}`}</p>
      ) : (
        <>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Distribución de los cierres</p>
            <div className="flex items-end gap-2 h-[84px]">
              {d.buckets.map((b) => (
                <button key={b.key} type="button" disabled={b.n === 0} onClick={() => onList(b.leads, `Cerrados en ${b.key}`)}
                  title={`Ver los leads cerrados en ${b.key}`}
                  className="row-hover flex-1 h-full flex flex-col items-center justify-end gap-1 rounded-md px-1 pt-1 text-[11px] text-slate-400 disabled:cursor-default cursor-pointer">
                  <span className="tabular-nums text-slate-300">{b.n}</span>
                  <span className="w-full rounded-t" style={{ height: `${(b.n / maxBucket) * 52}px`, minHeight: b.n ? 3 : 0, backgroundColor: b.key === ">30 d" ? "#E24B4A" : "#378ADD" }} />
                  <span>{b.key}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Por preventa · de Abierto a Cerrado</p>
            <div className="max-h-[15rem] overflow-y-auto pr-1 space-y-0.5">
              {d.people.map((p) => (
                <button key={p.name} type="button" onClick={() => (p.name === SIN ? onList(p.leads, p.name) : onOpenPreventa(p.name))}
                  title={p.name === SIN ? "Ver sus leads" : "Abrir la ficha de este preventa"}
                  className="row-hover w-full flex items-center gap-3 text-xs rounded-lg px-1.5 py-1.5 text-left cursor-pointer">
                  <span className="w-44 shrink-0 truncate font-medium text-slate-200" title={p.name}>{p.name}</span>
                  <span className="relative flex-1 h-2 rounded-full bg-white/[0.08]">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(p.avg / maxAvg) * 100}%`, backgroundColor: tone(p.avg) }} />
                    <span className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-slate-200" style={{ left: `${(p.med / maxAvg) * 100}%` }} title={`Mediana ${fmtDays(p.med)}`} />
                  </span>
                  <span className="w-28 shrink-0 text-right tabular-nums text-slate-400">{fmtDays(p.avg)} · n={p.n}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-500">La barra es el promedio y la marca vertical la mediana. Un ciclo va de pasar a ABIERTO a pasar a CERRADO; un lead reabierto cuenta como un ciclo nuevo.</p>
        </>
      )}
    </div>
  );
}
