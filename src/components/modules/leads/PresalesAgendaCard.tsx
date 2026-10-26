"use client";

import { useMemo, useState } from "react";
import type { Lead } from "@/lib/odoo/types";

/* Agenda de cierres: leads abiertos con fecha de cierre esperada (date_deadline), agrupados por semana. */

type Range = "30" | "60" | "over" | "all";
const isInt = (l: Lead) => (l.compania || "").toLowerCase().includes("international");
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const dateOf = (l: Lead) => new Date(`${l.cierreEsperado.substring(0, 10)}T12:00:00`);

function weekStart(d: Date) {
  const w = new Date(d);
  w.setHours(12, 0, 0, 0);
  const dow = (w.getDay() + 6) % 7;   // lunes = 0
  w.setDate(w.getDate() - dow);
  return w;
}

export default function PresalesAgendaCard({
  leads, daysToClose, fmtCOP, fmtUSD, onOpenLead,
}: {
  leads: Lead[];                                     // abiertos, con los filtros de la página
  daysToClose: (l: Lead) => number | null;
  fmtCOP: (v: number) => string;
  fmtUSD: (v: number) => string;
  onOpenLead: (l: Lead) => void;
}) {
  const [range, setRange] = useState<Range>("30");

  const withDays = useMemo(() => leads
    .flatMap((l) => { const d = daysToClose(l); return d === null ? [] : [{ lead: l, days: d }]; })
    .sort((a, b) => a.days - b.days || a.lead.cierreEsperado.localeCompare(b.lead.cierreEsperado)), [leads, daysToClose]);

  const counts = {
    "30": withDays.filter((x) => x.days >= 0 && x.days <= 30).length,
    "60": withDays.filter((x) => x.days >= 0 && x.days <= 60).length,
    over: withDays.filter((x) => x.days < 0).length,
    all: withDays.filter((x) => x.days >= 0).length,
  };

  const shown = useMemo(() => withDays.filter((x) =>
    range === "30" ? x.days >= 0 && x.days <= 30
    : range === "60" ? x.days >= 0 && x.days <= 60
    : range === "over" ? x.days < 0
    : x.days >= 0), [withDays, range]);

  const groups = useMemo(() => {
    const thisWeek = weekStart(new Date()).getTime();
    const out: { key: number; label: string; items: typeof shown }[] = [];
    for (const x of shown) {
      const ws = weekStart(dateOf(x.lead));
      const key = ws.getTime();
      let g = out.find((o) => o.key === key);
      if (!g) {
        const we = new Date(ws); we.setDate(we.getDate() + 6);
        const span = ws.getMonth() === we.getMonth()
          ? `${ws.getDate()}–${we.getDate()} ${MES[we.getMonth()]}`
          : `${ws.getDate()} ${MES[ws.getMonth()]} – ${we.getDate()} ${MES[we.getMonth()]}`;
        g = { key, label: key === thisWeek ? `Esta semana · ${span}` : key < thisWeek ? `Semana del ${span}` : span, items: [] };
        out.push(g);
      }
      g.items.push(x);
    }
    return out;
  }, [shown]);

  const money = (arr: Lead[]) => {
    const cop = arr.filter((l) => !isInt(l)).reduce((s, l) => s + l.ingresosEsperados, 0);
    const usd = arr.filter(isInt).reduce((s, l) => s + l.ingresosEsperados, 0);
    return `${cop ? fmtCOP(cop) : ""}${cop && usd ? " · " : ""}${usd ? fmtUSD(usd) : ""}` || "—";
  };
  const badge = (days: number) => days < 0
    ? { txt: `hace ${-days} d`, cls: "bg-rose-500/15 text-rose-500" }
    : days <= 7 ? { txt: days === 0 ? "hoy" : `en ${days} d`, cls: "bg-rose-500/15 text-rose-500" }
    : days <= 15 ? { txt: `en ${days} d`, cls: "bg-amber-500/15 text-amber-600" }
    : { txt: `en ${days} d`, cls: "bg-emerald-500/15 text-emerald-600" };

  const chips: [Range, string][] = [["30", `Próximos 30 días · ${counts["30"]}`], ["60", `60 días · ${counts["60"]}`], ["over", `Vencidos · ${counts.over}`], ["all", `Todos · ${counts.all}`]];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-1">
        {chips.map(([id, label]) => (
          <button key={id} type="button" onClick={() => setRange(id)} data-active={range === id}
            className="pill-option text-[11px] font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap">{label}</button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-10">{range === "over" ? "No hay leads abiertos con la fecha de cierre vencida" : "No hay cierres esperados en este rango"}</p>
      ) : (
        <div className="max-h-[22rem] overflow-y-auto pr-1">
          {groups.map((g) => (
            <section key={g.key} className="mt-3">
              <h4 className="flex justify-between gap-3 text-[11px] font-medium text-slate-400 mb-1.5">
                <span>{g.label}</span>
                <span className="tabular-nums">{g.items.length} {g.items.length === 1 ? "lead" : "leads"} · {money(g.items.map((x) => x.lead))}</span>
              </h4>
              <div className="space-y-1">
                {g.items.map(({ lead: l, days }) => {
                  const dt = dateOf(l);
                  const b = badge(days);
                  return (
                    <button key={l.id} type="button" onClick={() => onOpenLead(l)}
                      className="row-hover w-full flex items-center gap-3 text-left rounded-lg border border-white/[0.08] px-2.5 py-2 cursor-pointer">
                      <span className="w-10 shrink-0 text-center leading-none">
                        <b className="block text-[15px] font-semibold text-slate-100">{dt.getDate()}</b>
                        <small className="text-[10px] uppercase text-slate-500">{MES[dt.getMonth()]}</small>
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-xs font-semibold text-slate-100 truncate" title={l.nombre}>{l.nombre}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{l.preventa || "Sin preventa"} · {isInt(l) ? "GD INTERNATIONAL" : "GROW DATA"}</span>
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-slate-300">{l.ingresosEsperados ? (isInt(l) ? fmtUSD(l.ingresosEsperados) : fmtCOP(l.ingresosEsperados)) : "—"}</span>
                      <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${b.cls}`}>{b.txt}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="text-[11px] text-slate-500 mt-3">Según los días que faltan: rojo hasta 7, ámbar hasta 15 y verde después. Clic para abrir el lead.</p>
    </div>
  );
}
