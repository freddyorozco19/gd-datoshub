"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";

/* Fabricantes: ranking por leads o por pipeline abierto, con la tasa de ganados entre los leads ya cerrados.
   Un lead puede tener varios fabricantes: cuenta una vez en cada uno. "N/A" no es un fabricante: se aparta como cobertura pendiente. */

export type FabMetric = "leads" | "pipeline";
type Metric = FabMetric;
const isNA = (n: string) => /^n\s*\/?\s*a$/i.test(n.trim());
const num = (n: number) => n.toLocaleString("es-CO");
const fmtM = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M` : `$${Math.round(v / 1e6).toLocaleString("es-CO")} M`);
const isCOP = (l: Lead) => !/international/i.test(l.compania);   // el pipeline solo suma COP: GD INTERNATIONAL va en USD

export default function FabricantesCard({
  byLead, error, scope, metric, onList,
}: {
  byLead: Record<string, string[]> | null;
  error: string | null;
  scope: Lead[];
  metric: Metric;          // la elige el header de la card (pills Leads / Pipeline)
  onList: (leads: Lead[], heading: string) => void;
}) {
  const d = useMemo(() => {
    if (!byLead) return null;
    const by = new Map<string, { leads: Lead[]; won: number; lost: number; pipe: number }>();
    let withLine = 0, useful = 0, several = 0;
    const onlyNA: Lead[] = [];
    for (const l of scope) {
      const names = byLead[String(l.id)];
      if (!names?.length) continue;
      withLine++;
      const real = [...new Set(names.filter((n) => !isNA(n)).map((n) => n.trim()))];
      if (!real.length) { onlyNA.push(l); continue; }
      useful++;
      if (real.length > 1) several++;
      for (const n of real) {
        const e = by.get(n) ?? { leads: [], won: 0, lost: 0, pipe: 0 };
        e.leads.push(l);
        if (l.ganado === "Ganado") e.won++;
        else if (l.ganado === "Perdido") e.lost++;
        else if (l.activo && isCOP(l)) e.pipe += l.ingresosEsperados;
        by.set(n, e);
      }
    }
    const rows = [...by.entries()].map(([name, e]) => ({
      name, n: e.leads.length, leads: e.leads, pipe: e.pipe,
      rate: e.won + e.lost > 0 ? e.won / (e.won + e.lost) : null, closed: e.won + e.lost,
    }));
    return { rows, withLine, useful, several, onlyNA };
  }, [byLead, scope]);

  if (error) return <p className="text-xs text-rose-500 text-center py-8">{error}</p>;
  if (!d) return <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Cargando fabricantes…</div>;

  const rows = [...d.rows].sort((a, b) => (metric === "leads" ? b.n - a.n : b.pipe - a.pipe) || b.n - a.n);
  const max = Math.max(1, ...rows.map((r) => (metric === "leads" ? r.n : r.pipe)));
  const rateTone = (r: number) => (r >= 0.3 ? "text-emerald-400 bg-emerald-500/10" : r >= 0.15 ? "text-amber-400 bg-amber-500/10" : "text-rose-400 bg-rose-500/10");

  // mismo tamaño que las tarjetas de métricas de Tiempo de ciclo; el detalle va en el tooltip
  const stat = (label: string, value: string, hint: string) => (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 min-w-0" title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-100 truncate">{value}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {stat("Leads con fabricante", num(d.withLine), `de ${num(scope.length)} en el filtro`)}
        {stat("Con dato útil", num(d.useful), "sin contar N/A")}
        {stat("Con varios fabricantes", num(d.several), "hasta 4 por lead")}
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">No hay leads con fabricante con estos filtros</p>
      ) : (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
            {metric === "leads" ? "Ranking por leads" : "Ranking por pipeline abierto (solo COP)"} · tasa de ganados entre los cerrados
          </p>
          <div className="max-h-[22rem] overflow-y-auto pr-1 space-y-0.5">
            {rows.map((r) => (
              <button key={r.name} type="button" onClick={() => onList(r.leads, `Fabricante · ${r.name}`)} title={`Ver los ${r.n} leads de ${r.name}`}
                className="row-hover w-full flex items-center gap-3 text-xs rounded-lg px-1.5 py-1.5 text-left cursor-pointer">
                <span className="w-36 shrink-0 truncate font-medium text-slate-200" title={r.name}>{r.name}</span>
                <span className="relative flex-1 h-2.5 rounded-full bg-white/[0.08]">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-blue-500" style={{ width: `${((metric === "leads" ? r.n : r.pipe) / max) * 100}%` }} />
                </span>
                <span className="w-20 shrink-0 text-right tabular-nums text-slate-400">{metric === "leads" ? r.n : r.pipe ? fmtM(r.pipe) : "—"}</span>
                <span className={`w-14 shrink-0 text-center tabular-nums rounded-md px-1.5 py-0.5 ${r.rate === null ? "text-slate-500" : rateTone(r.rate)}`}
                  title={r.rate === null ? "Aún no tiene leads cerrados" : `${r.closed} leads cerrados`}>
                  {r.rate === null ? "—" : `${Math.round(r.rate * 100)} %`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {d.onlyNA.length > 0 && (
        <button type="button" onClick={() => onList(d.onlyNA, "Fabricante pendiente (N/A)")}
          className="w-full text-left text-[11px] rounded-lg px-3 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15 transition-colors cursor-pointer">
          {num(d.onlyNA.length)} leads solo tienen N/A como fabricante y no entran al ranking · ver la lista
        </button>
      )}
    </div>
  );
}
