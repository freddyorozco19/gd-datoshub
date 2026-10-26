"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import type { PresalesResponse } from "@/lib/odoo/client";
import { fmtDays } from "./presalesCycle";
import { responseStats, SOURCE_LABEL } from "./presalesResponse";

/* Tiempo de respuesta de preventa: del paso a la etapa Preventa a la primera acción de la preventa asignada. */

const num = (n: number) => n.toLocaleString("es-CO");

export default function PresalesResponseCard({
  data, error, scope, year, slaDays, onList, onOpenLead, onOpenPreventa,
}: {
  data: PresalesResponse | null;
  error: string | null;
  scope: Lead[];
  year: number | "ALL";
  slaDays: number;
  onList: (leads: Lead[], heading: string) => void;
  onOpenLead: (l: Lead) => void;
  onOpenPreventa: (name: string) => void;
}) {
  const [biz, setBiz] = useState(false);
  const [now] = useState(() => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 19).replace("T", " "));   // hora actual en GMT-5
  const d = useMemo(() => {
    return responseStats(data, scope, year, biz, now);
  }, [data, scope, year, biz, now]);

  if (error) return <p className="text-xs text-rose-500 text-center py-8">{error}</p>;
  if (!data) return <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Cargando historial…</div>;

  const measured = d.rows.length;
  const maxBucket = Math.max(1, ...d.buckets.map((b) => b.n));
  const maxMed = Math.max(slaDays * 2, ...d.people.map((p) => p.med), 1);
  const tone = (v: number) => (v > slaDays * 2 ? "#E24B4A" : v > slaDays ? "#EF9F27" : "#1D9E75");
  const bucketTone = (k: string) => (k === "Más de 7" ? "#E24B4A" : k === "3–7 días" ? "#EF9F27" : "#1D9E75");
  const waitingLeads = d.waiting.map((w) => w.lead);

  const stat = (label: string, value: string, sub: string, onClick?: () => void, danger?: boolean) => {
    const body = (
      <>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
        <p className={`text-lg font-semibold tabular-nums truncate ${danger ? "text-rose-400" : "text-slate-100"}`}>{value}</p>
        <p className="text-[11px] text-slate-500 truncate">{sub}</p>
      </>
    );
    const cls = "rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 min-w-0 text-left";
    return onClick
      ? <button type="button" onClick={onClick} className={`${cls} kpi-click cursor-pointer`}>{body}</button>
      : <div className={cls}>{body}</div>;
  };

  const sources = (["estado", "nota", "actividad", "cambio"] as const)
    .map((k) => ({ k, n: d.rows.filter((r) => r.item.source === k).length }))
    .filter((x) => x.n)
    .map((x) => `${x.n} ${SOURCE_LABEL[x.k]}`)
    .join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={() => setBiz((v) => !v)} data-active={biz} aria-pressed={biz}
          title="Descuenta sábados y domingos del tiempo transcurrido"
          className="pill-option text-[11px] font-semibold px-3 py-1.5 rounded-lg border whitespace-nowrap">Días hábiles</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stat("Mediana", measured ? fmtDays(d.med) : "—", `meta ${slaDays} d`)}
        {stat("Percentil 90", measured ? fmtDays(d.p90) : "—", "el 10 % más lento")}
        {stat("Sin respuesta aún", num(d.waiting.length), "leads esperando",
          d.waiting.length ? () => onList(waitingLeads, "Sin primera acción de preventa") : undefined, d.waiting.length > 0)}
        {stat("Cobertura", `${num(measured)}/${num(d.universe)}`, d.universe ? `${Math.round((measured / d.universe) * 100)} % con dato` : "sin leads")}
      </div>

      {d.universe === 0 ? (
        <p className="text-xs text-slate-500 text-center py-6">No hay leads que hayan pasado a Preventa con estos filtros{year === "ALL" ? "" : ` en ${year}`}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Distribución (leads)</p>
              <div className="space-y-1">
                {d.buckets.map((b) => (
                  <button key={b.key} type="button" disabled={b.n === 0} onClick={() => onList(b.leads, `Respuesta de preventa · ${b.key}`)}
                    className="row-hover w-full flex items-center gap-3 text-xs rounded-lg px-1.5 py-1.5 text-left disabled:cursor-default cursor-pointer">
                    <span className="w-20 shrink-0 text-slate-300">{b.key}</span>
                    <span className="relative flex-1 h-2.5 rounded-full bg-white/[0.08]">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(b.n / maxBucket) * 100}%`, backgroundColor: bucketTone(b.key) }} />
                    </span>
                    <span className="w-10 shrink-0 text-right tabular-nums text-slate-400">{b.n}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Esperando primera acción</p>
              {d.waiting.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">Todos los leads abiertos que pasaron a Preventa ya tienen una primera acción.</p>
              ) : (
                <div className="space-y-0.5">
                  {d.waiting.slice(0, 5).map((w) => (
                    <button key={w.lead.id} type="button" onClick={() => onOpenLead(w.lead)}
                      className="row-hover w-full flex items-start justify-between gap-3 text-xs rounded-lg px-1.5 py-1.5 text-left cursor-pointer">
                      <span className="min-w-0">
                        <span className="block truncate text-slate-200">#{w.lead.id} · {w.lead.nombre}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {w.lead.preventa || "Sin preventa"} · {w.item.startSource === "etapa" ? "pasó a Preventa" : "creado en Preventa"}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums font-medium text-rose-400">{fmtDays(w.days)}</span>
                    </button>
                  ))}
                  {d.waiting.length > 5 && (
                    <button type="button" onClick={() => onList(waitingLeads, "Sin primera acción de preventa")}
                      className="text-[11px] text-slate-500 hover:text-slate-300 px-1.5 pt-1">+{d.waiting.length - 5} más · ver la lista</button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Mediana por preventa · la marca vertical es la meta de {slaDays} {slaDays === 1 ? "día" : "días"}
            </p>
            <div className="max-h-[15rem] overflow-y-auto pr-1 space-y-0.5">
              {d.people.map((p) => (
                <button key={p.name} type="button" onClick={() => (p.name === "Sin preventa" ? onList(p.leads, p.name) : onOpenPreventa(p.name))}
                  title={p.name === "Sin preventa" ? "Ver sus leads" : "Abrir la ficha de este preventa"}
                  className="row-hover w-full flex items-center gap-3 text-xs rounded-lg px-1.5 py-1.5 text-left cursor-pointer">
                  <span className="w-44 shrink-0 truncate font-medium text-slate-200" title={p.name}>{p.name}</span>
                  <span className="relative flex-1 h-2 rounded-full bg-white/[0.08]">
                    <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (p.med / maxMed) * 100)}%`, backgroundColor: tone(p.med) }} />
                    <span className="absolute -top-0.5 -bottom-0.5 w-0.5 rounded bg-slate-200" style={{ left: `${(slaDays / maxMed) * 100}%` }} title={`Meta ${slaDays} d`} />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-slate-400">{fmtDays(p.med)} · n={p.n}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-500">Primera acción medida por: {sources || "—"}.</p>
        </>
      )}
    </div>
  );
}
