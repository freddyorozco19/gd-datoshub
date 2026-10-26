import type { Lead } from "@/lib/odoo/types";
import type { PresalesResponse, ResponseSource } from "@/lib/odoo/client";
import { median } from "./presalesCycle";

/* Cálculos del tiempo de respuesta de preventa: del paso a la etapa Preventa a la primera acción de la preventa. */

export type RespItem = PresalesResponse["items"][number];

const ms = (s: string) => Date.parse(s.replace(" ", "T") + "Z");   // las fechas ya vienen en GMT-5: se leen como "UTC" solo para restar
const DAY = 86400000;

/** Tiempo transcurrido en días; con `biz` se descuentan sábados y domingos. */
export function elapsedDays(from: string, to: string, biz: boolean): number {
  const a = ms(from), b = ms(to);
  if (b <= a) return 0;
  if (!biz) return (b - a) / DAY;
  let total = 0;
  for (let t = Math.floor(a / DAY) * DAY; t < b; t += DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    total += Math.min(b, t + DAY) - Math.max(a, t);
  }
  return total / DAY;
}

export const RESP_BUCKETS = [
  { key: "Mismo día", max: 1 },
  { key: "1–2 días",  max: 3 },
  { key: "3–7 días",  max: 8 },
  { key: "Más de 7",  max: Infinity },
] as const;
export const respBucket = (d: number) => RESP_BUCKETS.find((b) => d < b.max)!.key;

export const SOURCE_LABEL: Record<ResponseSource, string> = {
  estado: "pasó a ABIERTO", nota: "nota o mensaje", actividad: "actividad", cambio: "cambio en el lead",
};

const IDENT = new Set(["identificacion de oportunidad", "new", "registro de oportunidad", "definicion de requerimientos", "estudio de mercado", "eliminar 1", "eliminar 2", ""]);
const FINAL = new Set(["oferta ganada", "won", "oferta declinada", "oferta no viable"]);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export interface RespRow { item: RespItem; lead: Lead; days: number }

export function responseStats(data: PresalesResponse | null, scope: Lead[], year: number | "ALL", biz: boolean, nowStr: string) {
  const byId = new Map(scope.map((l) => [l.id, l]));
  const rows: RespRow[] = [];
  const waiting: RespRow[] = [];
  let universe = 0;
  for (const item of data?.items ?? []) {
    const lead = byId.get(item.leadId);
    if (!lead) continue;
    // un lead con preventa pero todavía en etapas previas no ha "entrado" a Preventa: su creación no es un inicio válido
    if (item.startSource === "creado" && IDENT.has(norm(lead.etapa))) continue;
    if (year !== "ALL" && !item.start.startsWith(String(year))) continue;
    universe++;
    if (item.first) { rows.push({ item, lead, days: elapsedDays(item.start, item.first, biz) }); continue; }
    const open = lead.activo && !FINAL.has(norm(lead.etapa)) && norm(lead.etapaPreventa) !== "cerrado";
    if (open) waiting.push({ item, lead, days: elapsedDays(item.start, nowStr, biz) });
  }
  waiting.sort((a, b) => b.days - a.days);
  const days = rows.map((r) => r.days);
  const p90 = (() => {
    if (!days.length) return 0;
    const s = [...days].sort((x, y) => x - y);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
  })();
  const buckets = RESP_BUCKETS.map((b) => {
    const rs = rows.filter((r) => respBucket(r.days) === b.key);
    return { key: b.key, n: rs.length, leads: rs.map((r) => r.lead) };
  });
  const byPrev = new Map<string, RespRow[]>();
  for (const r of rows) { const k = r.lead.preventa || "Sin preventa"; byPrev.set(k, [...(byPrev.get(k) ?? []), r]); }
  const people = [...byPrev.entries()]
    .map(([name, rs]) => ({ name, n: rs.length, med: median(rs.map((r) => r.days)), leads: rs.map((r) => r.lead) }))
    .sort((a, b) => b.med - a.med);
  return { rows, waiting, universe, med: median(days), p90, buckets, people };
}
