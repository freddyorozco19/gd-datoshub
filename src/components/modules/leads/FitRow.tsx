"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";

/* Barra de dos grupos (izquierda / derecha) que ocupa una sola línea: si el ancho disponible no alcanza
   para su tamaño natural, todo el contenido se reduce proporcionalmente (transform: scale). Cuando la
   reducción pasaría de COMPACT_BELOW (texto ya pequeño), el grupo izquierdo (los filtros) se pliega en
   un botón "Más filtros" que abre un panel, y el derecho vuelve a su tamaño real. Las medidas usan
   offsetWidth/offsetHeight, que ignoran transforms. */
const COMPACT_BELOW = 0.75;   // se pliega por debajo de esta escala…
const COMPACT_EXIT = 0.82;    // …y vuelve a la barra completa por encima de esta (histéresis)
const MIN_SCALE = 0.55;
const GAP = 16;

export default function FitRow({ left, right, moreLabel = "Más filtros" }: { left: ReactNode; right?: ReactNode; moreLabel?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const leftW = useRef(0);
  const compactRef = useRef(false);
  const [m, setM] = useState({ scale: 1, h: 0 });
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const measure = () => {
      const l = leftRef.current, r = rightRef.current;
      if (l) leftW.current = l.offsetWidth;          // en modo compacto se conserva el último ancho natural
      const rw = r ? r.offsetWidth + GAP : 0;
      const natural = leftW.current + rw;
      if (!natural) return;
      const raw = outer.clientWidth / natural;
      const nextCompact = compactRef.current ? raw < COMPACT_EXIT : raw < COMPACT_BELOW;
      if (nextCompact !== compactRef.current) { compactRef.current = nextCompact; setCompact(nextCompact); if (!nextCompact) setOpen(false); }
      if (nextCompact) return;
      const scale = Math.max(MIN_SCALE, Math.min(1, raw));
      const h = Math.max(l?.offsetHeight ?? 0, r?.offsetHeight ?? 0);
      setM((p) => (Math.abs(p.scale - scale) < 0.001 && p.h === h ? p : { scale, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    if (leftRef.current) ro.observe(leftRef.current);
    if (rightRef.current) ro.observe(rightRef.current);
    return () => ro.disconnect();
  }, [compact]);

  useLayoutEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (compact) {
    return (
      <div ref={outerRef} className="w-full relative">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="pill-option flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border"
            data-active={open ? "true" : undefined}
          >
            <SlidersHorizontal size={13} /> {moreLabel}
          </button>
          {right && <div ref={rightRef} className="flex items-center gap-2 shrink-0">{right}</div>}
        </div>
        {open && (
          <div className="mt-2 rounded-xl border border-white/[0.1] p-4 shadow-xl" style={{ background: "var(--app-topbar-bg)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{moreLabel}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar filtros" className="text-slate-500 hover:text-slate-200"><X size={14} /></button>
            </div>
            <div className="flex flex-wrap items-end gap-x-3 gap-y-3">{left}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={outerRef} className="w-full" style={{ height: m.h * m.scale }}>
      <div
        className="flex items-end justify-between"
        style={{ width: `${100 / m.scale}%`, transform: `scale(${m.scale})`, transformOrigin: "top left", gap: GAP }}
      >
        <div ref={leftRef} className="flex items-end gap-x-3 shrink-0">{left}</div>
        {right && <div ref={rightRef} className="flex items-center gap-2 shrink-0">{right}</div>}
      </div>
    </div>
  );
}
