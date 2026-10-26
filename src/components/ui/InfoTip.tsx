"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

/* Icono ⓘ "Cómo se calcula": explica en una frase la regla de una cifra o panel y el campo de Odoo que usa.
   La ventana se dibuja en un portal (posición fija) para que no la recorten las cards con overflow-hidden. */

export interface InfoContent {
  rule: string;          // la regla, en una frase
  fields?: string[];     // campos de Odoo que usa (nombre técnico)
  note?: string;         // aclaración opcional
  title?: string;        // por defecto "Cómo se calcula"
}

const WIDTH = 300;

export default function InfoTip({ rule, fields, note, title = "Cómo se calcula", size = 13, className = "" }: InfoContent & { size?: number; className?: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);

  const cancel = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const open = useCallback(() => {
    cancel();
    const el = btn.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const above = r.bottom > window.innerHeight - 230;
    setPos({
      top: above ? r.top - 8 : r.bottom + 8,
      left: Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8),
      above,
    });
  }, []);
  const close = useCallback(() => { cancel(); setPos(null); }, []);
  const closeSoon = () => { cancel(); timer.current = setTimeout(() => setPos(null), 140); };

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [pos, close]);
  useEffect(() => () => cancel(), []);

  return (
    <>
      <button
        ref={btn} type="button" aria-label={title} aria-expanded={!!pos}
        onMouseEnter={open} onMouseLeave={closeSoon} onFocus={open} onBlur={closeSoon}
        onClick={(e) => { e.stopPropagation(); if (pos) close(); else open(); }}
        onKeyDown={(e) => e.stopPropagation()}
        className={`info-tip inline-flex items-center justify-center p-0.5 shrink-0 cursor-help ${className}`}
      >
        <Info size={size} aria-hidden />
      </button>
      {pos && createPortal(
        <div className="dashboard-shell">
          <div
            role="tooltip"
            onMouseEnter={cancel} onMouseLeave={closeSoon}
            className="info-pop fixed z-[70] rounded-xl p-3.5 text-left"
            style={{ top: pos.top, left: pos.left, width: WIDTH, transform: pos.above ? "translateY(-100%)" : undefined }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{title}</p>
            <p className="text-xs leading-relaxed text-slate-200">{rule}</p>
            {note && <p className="text-[11px] leading-relaxed text-slate-400 mt-1.5">{note}</p>}
            {fields && fields.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">Campo{fields.length > 1 ? "s" : ""} de Odoo</p>
                <div className="flex flex-wrap gap-1">
                  {fields.map((f) => <code key={f} className="info-code text-[11px] font-mono px-1.5 py-0.5 rounded">{f}</code>)}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
