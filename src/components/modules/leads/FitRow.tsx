"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/* Barra de dos grupos (izquierda / derecha) que SIEMPRE ocupa una sola línea: si el ancho disponible
   no alcanza para su tamaño natural, todo el contenido se reduce proporcionalmente (transform: scale)
   hasta un mínimo legible. Con espacio de sobra mantiene el tamaño original y el grupo derecho queda
   pegado al borde derecho. Las medidas usan offsetWidth/offsetHeight, que ignoran transforms. */
const MIN_SCALE = 0.55;
const GAP = 16;

export default function FitRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ scale: 1, h: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current, l = leftRef.current, r = rightRef.current;
    if (!outer || !l) return;
    const measure = () => {
      const natural = l.offsetWidth + (r ? r.offsetWidth + GAP : 0);
      const scale = Math.max(MIN_SCALE, Math.min(1, outer.clientWidth / natural));
      const h = Math.max(l.offsetHeight, r?.offsetHeight ?? 0);
      setM((p) => (Math.abs(p.scale - scale) < 0.001 && p.h === h ? p : { scale, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer); ro.observe(l); if (r) ro.observe(r);
    return () => ro.disconnect();
  }, []);

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
