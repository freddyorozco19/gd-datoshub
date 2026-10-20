import type { Lead } from "@/lib/odoo/types";
import type { PresalesTimeline } from "@/lib/odoo/client";

/* Cálculos del tiempo de ciclo en Preventa: de pasar a ABIERTO a pasar a CERRADO (fechas del historial de Odoo). */

export type Cycle = PresalesTimeline["cycles"][number];

const ms = (s: string) => Date.parse(s.replace(" ", "T") + "Z");
export const cycleDays = (c: Cycle) => (ms(c.close) - ms(c.open)) / 86400000;

export const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const fmtDays = (d: number) => `${d.toLocaleString("es-CO", { maximumFractionDigits: 1 })} d`;

export const BUCKETS = [
  { key: "≤3 d",    max: 3 },
  { key: "4–7 d",   max: 7 },
  { key: "8–14 d",  max: 14 },
  { key: "15–30 d", max: 30 },
  { key: ">30 d",   max: Infinity },
] as const;
export const bucketOf = (days: number) => BUCKETS.find((b) => days <= b.max)!.key;

/** Ciclos de los leads dados, cerrados en el año indicado ("ALL" = todos). */
export function cyclesFor(timeline: PresalesTimeline | null, leads: Lead[], year: number | "ALL"): { cycle: Cycle; lead: Lead; days: number }[] {
  if (!timeline) return [];
  const byId = new Map(leads.map((l) => [l.id, l]));
  const out: { cycle: Cycle; lead: Lead; days: number }[] = [];
  for (const c of timeline.cycles) {
    const lead = byId.get(c.leadId);
    if (!lead) continue;
    if (year !== "ALL" && !c.close.startsWith(String(year))) continue;
    out.push({ cycle: c, lead, days: cycleDays(c) });
  }
  return out;
}
