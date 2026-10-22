"use client";

import { Loader2, Check, Undo2 } from "lucide-react";
import type { LeadTimeline, StageKey } from "@/lib/odoo/client";

/* Pestaña "Timeline" del detalle de un lead: recorrido por las etapas del pipeline y por el Estado Preventa, con tiempos a escala. */

const MAIN: { key: StageKey; label: string }[] = [
  { key: "ident", label: "Identificación de Oportunidad" },
  { key: "prev",  label: "Preventa" },
  { key: "pres",  label: "Presentación de Oferta" },
  { key: "eval",  label: "Evaluación de la Entidad" },
  { key: "gan",   label: "Oferta Ganada" },
];
const NAME: Record<StageKey, string> = {
  ident: "Identificación", prev: "Preventa", pres: "Presentación de Oferta", eval: "Evaluación de la Entidad",
  gan: "Oferta Ganada", dec: "Oferta declinada", nov: "Oferta no viable",
};
const COLOR: Record<StageKey, string> = {
  ident: "#94a3b8", prev: "#378ADD", pres: "#8B5CF6", eval: "#F59E0B", gan: "#10B981", dec: "#E24B4A", nov: "#be123c",
};
const ESTADO_COLOR = { none: "rgba(148,163,184,0.25)", ab: "#1D9E75", ce: "#64748b", otro: "#F59E0B" } as const;

const ms = (s: string) => Date.parse(s.replace(" ", "T") + "Z");
const daysBetween = (a: string, b: string) => (ms(b) - ms(a)) / 86400000;
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dd = (s: string) => `${Number(s.slice(8, 10))} ${MES[Number(s.slice(5, 7)) - 1]}`;
const dt = (s: string) => `${dd(s)} ${s.slice(11, 16)}`;
const fmt = (d: number) => {
  if (d < 1 / 24 / 2) return "<1 min";
  if (d < 1) return `${Math.round(d * 24)} h`;
  return `${d >= 10 ? Math.round(d) : d.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`;
};

export default function LeadTimelinePanel({ timeline: t, loading, error }: { timeline: LeadTimeline | null; loading: boolean; error: string | null }) {
  if (loading) return <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-xs"><Loader2 size={13} className="animate-spin" /> Cargando el recorrido…</div>;
  if (error) return <p className="text-xs text-rose-500 text-center py-8">{error}</p>;
  if (!t) return null;

  const total = Math.max(daysBetween(t.created, t.end), 1 / 1440);
  const perStage: Partial<Record<StageKey, number>> = {};
  const first: Partial<Record<StageKey, string>> = {};
  for (const s of t.stages) {
    perStage[s.key] = (perStage[s.key] ?? 0) + daysBetween(s.from, s.to);
    if (!first[s.key]) first[s.key] = s.from;
  }
  const inPrev = perStage.prev ?? 0;
  const reopen = t.stages.filter((s, i) => i > 0 && (t.stages[i - 1].key === "dec" || t.stages[i - 1].key === "nov") && s.key !== "dec" && s.key !== "nov").length;
  const visitedMain = MAIN.filter((m) => perStage[m.key] !== undefined).length;
  const branches = t.stages.map((s, i) => ({ s, i })).filter(({ s }) => s.key === "dec" || s.key === "nov");

  // la última etapa principal alcanzada (si el lead terminó en declinada o no viable, no hay nodo "actual")
  const currentMain = MAIN.some((m) => m.key === t.current) ? t.current : null;

  const stat = (label: string, value: string, hint?: string) => (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-slate-100 truncate">{value}{hint && <span className="ml-1 text-[11px] font-normal text-slate-500">{hint}</span>}</p>
    </div>
  );

  const endLabel = t.terminal ? (t.current === "gan" ? "ganado" : t.current === "dec" ? "declinado" : "no viable") : "hoy";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Recorrido por etapas</h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          {stat("Tiempo total", fmt(total))}
          {stat("En Preventa", fmt(inPrev), total ? `${Math.round((inPrev / total) * 100)} %` : "")}
          {stat("Etapas recorridas", String(visitedMain), "de 5")}
          {stat("Reaperturas", String(reopen))}
        </div>

        {/* pasos del pipeline */}
        <div className="grid grid-cols-5">
          {MAIN.map((m, i) => {
            const visited = perStage[m.key] !== undefined;
            const isCur = m.key === currentMain;
            const color = COLOR[m.key];
            return (
              <div key={m.key} className="relative text-center px-1">
                {i > 0 && <span className="absolute top-[13px] left-[-50%] right-[50%] h-[3px] rounded" style={{ background: visited ? color : "rgba(148,163,184,0.25)" }} />}
                <span className="relative z-10 mx-auto w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold border-2"
                  style={visited ? { background: color, borderColor: color, color: "#fff", boxShadow: isCur ? `0 0 0 5px ${color}33` : undefined } : { borderColor: "rgba(148,163,184,0.35)", color: "#94a3b8" }}>
                  {visited ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <p className={`mt-2 text-[11px] leading-tight ${visited ? "font-semibold text-slate-100" : "text-slate-500"}`}>{m.label}</p>
                {visited ? (
                  <>
                    <p className="mt-0.5 text-xs font-semibold tabular-nums" style={{ color }}>{fmt(perStage[m.key]!)}</p>
                    <p className="text-[10px] text-slate-500">desde {dd(first[m.key]!)}</p>
                  </>
                ) : <p className="mt-0.5 text-[10px] text-slate-500">pendiente</p>}
              </div>
            );
          })}
        </div>

        {branches.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {branches.map(({ s, i }) => {
              const back = t.stages[i + 1];
              return (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border"
                  style={{ background: `${COLOR[s.key]}1f`, borderColor: `${COLOR[s.key]}59`, color: COLOR[s.key] }}>
                  <Undo2 size={11} />
                  {NAME[s.key]} · {fmt(daysBetween(s.from, s.to))} ({dd(s.from)}{back ? ` → ${dd(s.to)}, reabierto` : ""})
                </span>
              );
            })}
          </div>
        )}

        {/* barra a escala */}
        <p className="mt-5 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tiempo en cada etapa (a escala)</p>
        <div className="flex h-[30px] gap-0.5 rounded-lg overflow-hidden">
          {t.stages.map((s, i) => {
            const d = daysBetween(s.from, s.to);
            const w = (d / total) * 100;
            return (
              <div key={i} className="flex items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-semibold text-white shrink-0"
                style={{ width: `${w}%`, minWidth: 5, background: COLOR[s.key] }} title={`${NAME[s.key]} · ${dt(s.from)} → ${dt(s.to)} · ${fmt(d)}`}>
                {w > 14 ? `${NAME[s.key]} · ${fmt(d)}` : w > 6 ? fmt(d) : ""}
              </div>
            );
          })}
        </div>

        <p className="mt-3 mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Estado Preventa</p>
        <div className="flex h-3 gap-0.5 rounded overflow-hidden">
          {t.estados.map((s, i) => (
            <div key={i} className="shrink-0" style={{ width: `${(daysBetween(s.from, s.to) / total) * 100}%`, minWidth: 3, background: ESTADO_COLOR[s.key] }}
              title={`${s.label} · ${dt(s.from)} → ${dt(s.to)} · ${fmt(daysBetween(s.from, s.to))}`} />
          ))}
        </div>

        <div className="mt-1.5 flex justify-between text-[10px] text-slate-500 tabular-nums">
          <span>{dd(t.created)}</span>
          <span>{total > 40 ? dd(new Date((ms(t.created) + ms(t.end)) / 2).toISOString().slice(0, 19).replace("T", " ")) : ""}</span>
          <span>{endLabel} · {dd(t.end)}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
          {(["ident", "prev", "pres", "eval", "gan", "dec"] as StageKey[]).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: COLOR[k] }} />{NAME[k]}</span>
          ))}
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: ESTADO_COLOR.ab }} />Abierto</span>
          <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm" style={{ background: ESTADO_COLOR.ce }} />Cerrado</span>
        </div>
        {t.deadline && !t.terminal && <p className="mt-3 text-[11px] text-slate-500">Cierre esperado: {dd(t.deadline.slice(0, 10) + " 12:00:00")}</p>}
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1.5 border-b border-white/[0.05]">Cambios de etapa y estado</h3>
        {t.events.length === 0 ? <p className="text-xs text-slate-500 text-center py-3">Este lead no tiene cambios registrados</p> : (
          <ol className="divide-y divide-white/[0.05]">
            {t.events.map((e, i) => (
              <li key={i} className="flex items-baseline gap-3 py-1.5 text-xs">
                <time className="w-28 shrink-0 text-[11px] tabular-nums text-slate-500">{dt(e.date)}</time>
                <i className="w-2 h-2 rounded-full shrink-0 self-center" style={{ background: e.kind === "stage" ? "#378ADD" : "#1D9E75" }} />
                <span className="text-slate-300"><b className="font-semibold text-slate-100">{e.kind === "stage" ? "Etapa" : "Estado preventa"}</b> · {e.text}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
