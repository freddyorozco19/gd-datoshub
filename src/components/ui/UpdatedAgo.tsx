"use client";

import { useEffect, useState } from "react";

/* "Actualizado hace 3 min": cuándo se leyeron por última vez los datos de Odoo. Se refresca solo cada 30 s. */

export function agoText(at: Date, now: number): string {
  const mins = Math.max(0, Math.floor((now - at.getTime()) / 60000));
  if (mins < 1) return "Actualizado ahora";
  if (mins < 60) return `Actualizado hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Actualizado hace ${h} h`;
  const d = Math.floor(h / 24);
  return `Actualizado hace ${d} ${d === 1 ? "día" : "días"}`;
}

export default function UpdatedAgo({ at, className = "" }: { at: Date | null; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  const stale = now - at.getTime() > 15 * 60000;   // más de 15 min: se resalta para que se note que los datos pueden estar viejos
  return (
    <span
      className={`text-[11px] tabular-nums whitespace-nowrap ${stale ? "text-amber-500" : "text-slate-500"} ${className}`}
      title={`Última lectura de Odoo: ${at.toLocaleString("es-CO")}`}
    >
      {agoText(at, now)}
    </span>
  );
}
