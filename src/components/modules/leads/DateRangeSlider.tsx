"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, X } from "lucide-react";

/* ── helpers de fecha para el slider de rango ─────────────────────────── */
const DAY_MS = 86400000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dateToIdx = (dateStr: string, minStr: string) => Math.round((new Date(dateStr).getTime() - new Date(minStr).getTime()) / DAY_MS);
const idxToDate = (idx: number, minStr: string) => {
  const d = new Date(minStr);
  d.setDate(d.getDate() + idx);
  return d.toISOString().substring(0, 10);
};
// AAAA-MM-DD → DD/MM/AAAA sin pasar por Date (evita el desfase de un día por zona horaria)
const fmtShortDate = (d: string) => { const [y, m, day] = d.substring(0, 10).split("-"); return `${day}/${m}/${y}`; };

/* periodos de un año calendario (meses base 0) */
const YEAR_PERIODS = [
  { key: "year", label: "Todo el año", startMonth: 0, endMonth: 11, span: true },
  { key: "s1",   label: "S1",          startMonth: 0, endMonth: 5,  span: false },
  { key: "s2",   label: "S2",          startMonth: 6, endMonth: 11, span: false },
  { key: "q1",   label: "Q1",          startMonth: 0, endMonth: 2,  span: false },
  { key: "q2",   label: "Q2",          startMonth: 3, endMonth: 5,  span: false },
  { key: "q3",   label: "Q3",          startMonth: 6, endMonth: 8,  span: false },
  { key: "q4",   label: "Q4",          startMonth: 9, endMonth: 11, span: false },
] as const;

/* ── slider de rango de fecha (reemplaza los inputs Desde/Hasta) ──────── */
export default function DateRangeSlider({
  min, max, from, to, onChange,
}: { min: string; max: string; from: string; to: string; onChange: (from: string, to: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number } | null>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 6, left: r.left });
    }
    setOpen((o) => !o);
  }

  const totalDays  = Math.max(1, dateToIdx(max, min));
  const fromDate   = from || min;
  const toDate     = to   || max;
  const fromIdx    = clamp(dateToIdx(fromDate, min), 0, totalDays);
  const toIdx      = clamp(dateToIdx(toDate, min), 0, totalDays);

  function handleFrom(v: number) {
    const nextFrom = Math.min(v, toIdx);
    onChange(idxToDate(nextFrom, min), idxToDate(toIdx, min));
  }
  function handleTo(v: number) {
    const nextTo = Math.max(v, fromIdx);
    onChange(idxToDate(fromIdx, min), idxToDate(nextTo, min));
  }

  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(max.slice(0, 4));
  const years   = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);
  const [year, setYear] = useState(maxYear);

  /* rango [inicio, fin] de un periodo del año, recortado a los datos disponibles; null si queda fuera */
  function periodRange(y: number, p: (typeof YEAR_PERIODS)[number]): [string, string] | null {
    const pad = (n: number) => String(n).padStart(2, "0");
    const endDay = new Date(y, p.endMonth + 1, 0).getDate();
    let s = `${y}-${pad(p.startMonth + 1)}-01`;
    let e = `${y}-${pad(p.endMonth + 1)}-${pad(endDay)}`;
    if (s < min) s = min;
    if (e > max) e = max;
    return s > e ? null : [s, e];
  }
  function applyPeriod(y: number, p: (typeof YEAR_PERIODS)[number]) {
    const r = periodRange(y, p);
    if (!r) return;
    onChange(r[0], r[1]);
  }

  const pctFrom = (fromIdx / totalDays) * 100;
  const pctTo   = (toIdx / totalDays) * 100;

  const hasCustomRange = !!(from || to);

  return (
    <div className="flex flex-col gap-1.5 shrink-0 w-60">
      <div className="flex items-center justify-center gap-1">
        <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Rango de fecha</label>
        {hasCustomRange && (
          <button
            type="button"
            onClick={() => onChange("", "")}
            title="Limpiar rango de fecha"
            className="text-slate-500 hover:text-rose-400 transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 h-8">
        <button
          type="button" ref={btnRef} onClick={toggle}
          title="Configurar rango de fecha"
          className={`shrink-0 p-0.5 rounded transition-colors ${open ? "text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
        >
          <Calendar size={14} />
        </button>

        <span className="shrink-0 text-[9px] text-slate-400 tabular-nums whitespace-nowrap">{fmtShortDate(fromDate)}</span>

        <div className="dual-range relative h-5 flex-1 min-w-[60px] flex items-center">
          <div className="absolute inset-x-0 h-1 rounded-full bg-white/[0.1]" />
          <div
            className="absolute h-1 rounded-full bg-blue-500"
            style={{ left: `${pctFrom}%`, right: `${100 - pctTo}%` }}
          />
          <input
            type="range" min={0} max={totalDays} value={fromIdx}
            onChange={(e) => handleFrom(Number(e.target.value))}
            className="dual-range-input"
          />
          <input
            type="range" min={0} max={totalDays} value={toIdx}
            onChange={(e) => handleTo(Number(e.target.value))}
            className="dual-range-input"
          />
        </div>

        <span className="shrink-0 text-[9px] text-slate-400 tabular-nums whitespace-nowrap">{fmtShortDate(toDate)}</span>
      </div>

      {open && rect && createPortal(
        <div className="dashboard-shell">
          <div
            ref={panelRef}
            style={{
              position: "fixed", top: rect.top, left: rect.left,
              backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)",
            }}
            className="z-50 w-64 rounded-lg border border-white/[0.12] bg-white/[0.08] shadow-2xl shadow-black/40 p-3 flex flex-col gap-3"
          >
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Rango personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Desde</span>
                  <input
                    type="date" value={fromDate} min={min} max={toDate}
                    onChange={(e) => onChange(e.target.value, toDate)}
                    className="text-xs rounded-lg px-2 py-1.5 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:outline-none focus:border-blue-500/60 text-slate-200 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500">Hasta</span>
                  <input
                    type="date" value={toDate} min={fromDate} max={max}
                    onChange={(e) => onChange(fromDate, e.target.value)}
                    className="text-xs rounded-lg px-2 py-1.5 bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:outline-none focus:border-blue-500/60 text-slate-200 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-white/[0.08]" />

            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Por año</p>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {years.map((y) => (
                  <button
                    key={y} type="button"
                    onClick={() => { setYear(y); applyPeriod(y, YEAR_PERIODS[0]); }}
                    className={`text-[11px] px-2.5 py-1.5 rounded-lg border tabular-nums transition-colors ${
                      y === year ? "filter-option-selected border-blue-500/40" : "filter-option bg-white/[0.04] border-white/[0.1] text-slate-300"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {YEAR_PERIODS.map((p) => {
                  const r = periodRange(year, p);
                  const active = !!r && r[0] === fromDate && r[1] === toDate;
                  return (
                    <button
                      key={p.key} type="button" disabled={!r}
                      onClick={() => applyPeriod(year, p)}
                      className={`text-[11px] px-2 py-1.5 rounded-lg border transition-colors disabled:opacity-30 disabled:pointer-events-none ${
                        p.span ? "col-span-2" : ""
                      } ${active ? "filter-option-selected border-blue-500/40" : "filter-option bg-white/[0.04] border-white/[0.1] text-slate-300"}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
