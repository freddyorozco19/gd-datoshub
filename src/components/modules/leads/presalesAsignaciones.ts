import type { Lead } from "@/lib/odoo/types";

/* Odoo separó la preventa en tres juegos de campos, uno por línea (Consultoría, Datos y SI, TI). Para Presales, un lead con
   varias asignaciones se "expande" en una fila por asignación: cada fila lleva su preventa, su estado, su línea y su parte del
   ingreso, de modo que tablas, ocupación y fichas cuentan la carga real de cada preventa sin tocar el resto de la lógica.
   Los leads sin asignaciones, o con la clásica (solo Consultoría), pasan sin cambios. */

export function expandAsignaciones(leads: Lead[]): Lead[] {
  return leads.flatMap((l) => {
    const as = l.asignaciones ?? [];
    if (as.length === 0 || (as.length === 1 && as[0].slot === 1)) return [l];

    const amountOf = (slot: number) => (slot === 1 ? l.consultoriaCOP : slot === 2 ? l.datosCOP : l.tiCOP);
    const byLine = as.reduce((s, a) => s + (amountOf(a.slot) || 0), 0);
    // ingreso por asignación: el monto de su línea si el lead lo trae; si no, el total repartido en partes iguales (nunca se duplica)
    const share = (slot: number) => (as.length === 1 ? l.ingresosEsperados : byLine > 0 ? amountOf(slot) || 0 : l.ingresosEsperados / as.length);

    // la misma persona en dos líneas del mismo lead cuenta una sola vez (es un lead de su carga, no dos): se fusionan sus asignaciones
    const merged = new Map<string, { a: (typeof as)[number]; ingreso: number }>();
    for (const a of as) {
      const key = a.preventa || `#${a.slot}`;
      const prev = merged.get(key);
      if (!prev) { merged.set(key, { a, ingreso: share(a.slot) }); continue; }
      const abierto = (x: string) => x.trim().toLowerCase() === "abierto";
      merged.set(key, { a: abierto(a.estado) && !abierto(prev.a.estado) ? { ...prev.a, estado: a.estado } : prev.a, ingreso: prev.ingreso + share(a.slot) });
    }
    return [...merged.values()].map(({ a, ingreso }): Lead => ({
      ...l,
      slot: a.slot,
      linea: a.linea,
      preventa: a.preventa,
      etapaPreventa: a.estado,
      fechaAsignacion: a.fechaAsignacion,
      ingresosEsperados: ingreso,
    }));
  });
}

/** Un lead por id (la primera fila): para listados y gráficos que cuentan leads, no asignaciones. */
export function uniqueById(leads: Lead[]): Lead[] {
  const seen = new Set<number>();
  return leads.filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
}

/** Enlaza un evento del historial (lead + línea) con su fila de Presales.
 *  Primero busca la fila de esa misma línea. Si no existe, usa la primera fila del lead: cuando Odoo creó los campos de preventa por línea,
 *  muchas asignaciones pasaron del campo original (línea 1) al de Datos y SI / TI, y su historial quedó guardado bajo la línea 1. */
export function eventMatcher(rows: Lead[]) {
  const byKey = new Map<string, Lead>();
  const byLead = new Map<number, Lead>();
  for (const l of rows) { byKey.set(`${l.id}-${l.slot ?? 1}`, l); if (!byLead.has(l.id)) byLead.set(l.id, l); }
  return (leadId: number, slot?: number): Lead | undefined => byKey.get(`${leadId}-${slot ?? 1}`) ?? byLead.get(leadId);
}

/** Clave estable de una fila de Presales (un lead puede aparecer una vez por línea). */
export const rowKey = (l: Lead) => `${l.id}-${l.slot ?? 1}`;
