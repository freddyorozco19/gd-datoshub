import type { Lead } from "@/lib/odoo/types";
import {
  STAGE_PROBABILITY, DEFAULT_STAGE_PROBABILITY, CLOSED_STAGES,
  ANNUAL_GOAL_COP, STALLED_DAYS, UPCOMING_DAYS,
} from "./config";

export type Period = "month" | "quarter" | "year";
export type Company = "COP" | "USD";

export interface Filters {
  period: Period;
  company: Company;
  linea: string;      // "ALL" = todas
  comercial: string;  // "ALL" = todos
  etapa: string;      // "ALL" = todas (filtro cruzado desde el embudo)
}

export const DEFAULT_FILTERS: Filters = { period: "quarter", company: "COP", linea: "ALL", comercial: "ALL", etapa: "ALL" };

const DAY = 86_400_000;
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/* ── clasificación de leads ─────────────────────────────────────────── */
export const companyOf = (l: Lead): Company => (/international|usd/i.test(l.compania) ? "USD" : "COP");
export const isWon  = (l: Lead) => l.ganado === "Ganado";
export const isLost = (l: Lead) => l.ganado === "Perdido";
export const isOpen = (l: Lead) => l.activo && !isWon(l) && !isLost(l) && !CLOSED_STAGES.includes(l.etapa);
export const closeDateOf = (l: Lead): Date | null => {
  const raw = l.fechaCierre || l.fechaEfectivaCierre;
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};
const parseDate = (s: string): Date | null => {
  const d = s ? new Date(s) : null;
  return d && !isNaN(d.getTime()) ? d : null;
};
export const probOf = (l: Lead) => STAGE_PROBABILITY[l.etapa] ?? DEFAULT_STAGE_PROBABILITY;

/* ── periodos ───────────────────────────────────────────────────────── */
export interface Range { start: Date; end: Date; prevStart: Date; prevEnd: Date; label: string }

export function periodRange(period: Period, now: Date): Range {
  const y = now.getFullYear(), m = now.getMonth();
  if (period === "month") {
    return { start: new Date(y, m, 1), end: new Date(y, m + 1, 1), prevStart: new Date(y, m - 1, 1), prevEnd: new Date(y, m, 1), label: `${MONTHS[m]} ${y}` };
  }
  if (period === "year") {
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), prevStart: new Date(y - 1, 0, 1), prevEnd: new Date(y, 0, 1), label: String(y) };
  }
  const q = Math.floor(m / 3);
  return { start: new Date(y, q * 3, 1), end: new Date(y, q * 3 + 3, 1), prevStart: new Date(y, q * 3 - 3, 1), prevEnd: new Date(y, q * 3, 1), label: `Q${q + 1} ${y}` };
}
const inRange = (d: Date | null, s: Date, e: Date) => !!d && d >= s && d < e;

/* ── filtros ────────────────────────────────────────────────────────── */
export function applyFilters(leads: Lead[], f: Filters): Lead[] {
  return leads.filter((l) =>
    companyOf(l) === f.company &&
    (f.linea === "ALL" || l.linea === f.linea) &&
    (f.comercial === "ALL" || l.comercial === f.comercial) &&
    (f.etapa === "ALL" || l.etapa === f.etapa),
  );
}

/* ── KPIs ───────────────────────────────────────────────────────────── */
export interface Kpis {
  pipeline: number; openCount: number; forecast: number;
  won: number; wonCount: number; prevWon: number;
  winRate: number | null; prevWinRate: number | null; cycleDays: number | null;
}

function winRateIn(leads: Lead[], s: Date, e: Date): number | null {
  const closed = leads.filter((l) => (isWon(l) || isLost(l)) && inRange(closeDateOf(l), s, e));
  if (!closed.length) return null;
  return Math.round((closed.filter(isWon).length / closed.length) * 100);
}

export function computeKpis(leads: Lead[], r: Range): Kpis {
  const open = leads.filter(isOpen);
  const wonNow  = leads.filter((l) => isWon(l) && inRange(closeDateOf(l), r.start, r.end));
  const wonPrev = leads.filter((l) => isWon(l) && inRange(closeDateOf(l), r.prevStart, r.prevEnd));
  const sum = (a: Lead[]) => a.reduce((acc, l) => acc + (l.ingresosEsperados || 0), 0);
  const cycles = wonNow
    .map((l) => { const c = closeDateOf(l), s = parseDate(l.fechaCreacion); return c && s ? (c.getTime() - s.getTime()) / DAY : null; })
    .filter((v): v is number => v !== null && v >= 0);
  return {
    pipeline: sum(open), openCount: open.length,
    forecast: open.reduce((acc, l) => acc + (l.ingresosEsperados || 0) * probOf(l), 0),
    won: sum(wonNow), wonCount: wonNow.length, prevWon: sum(wonPrev),
    winRate: winRateIn(leads, r.start, r.end), prevWinRate: winRateIn(leads, r.prevStart, r.prevEnd),
    cycleDays: cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null,
  };
}

/* ── embudo ─────────────────────────────────────────────────────────── */
export interface FunnelRow { etapa: string; count: number; value: number }
export function computeFunnel(leads: Lead[], stageOrder: string[]): FunnelRow[] {
  const open = leads.filter(isOpen);
  const names = [...stageOrder.filter((s) => !CLOSED_STAGES.includes(s)), ...new Set(open.map((l) => l.etapa).filter((e) => e && !stageOrder.includes(e)))];
  return names
    .map((etapa) => {
      const subset = open.filter((l) => l.etapa === etapa);
      return { etapa, count: subset.length, value: subset.reduce((a, l) => a + (l.ingresosEsperados || 0), 0) };
    })
    .filter((r) => r.count > 0);
}

/* ── ingresos acumulados del año ────────────────────────────────────── */
export interface RevenuePoint { name: string; real: number | null; proyeccion: number | null; meta: number | null }
export function computeRevenue(leads: Lead[], now: Date, forecast: number): RevenuePoint[] {
  const y = now.getFullYear(), cm = now.getMonth();
  const monthly = Array(12).fill(0) as number[];
  leads.filter(isWon).forEach((l) => {
    const d = closeDateOf(l);
    if (d && d.getFullYear() === y) monthly[d.getMonth()] += l.ingresosEsperados || 0;
  });
  let acc = 0;
  const cum = monthly.map((v) => (acc += v));
  const remaining = 12 - 1 - cm;
  return MONTHS.map((name, i) => ({
    name,
    real: i <= cm ? cum[i] : null,
    // proyección lineal: forecast ponderado repartido en los meses restantes, anclado al acumulado de hoy
    proyeccion: i >= cm && remaining > 0 ? cum[cm] + (forecast * (i - cm)) / remaining : i === cm ? cum[cm] : null,
    meta: ANNUAL_GOAL_COP ? (ANNUAL_GOAL_COP * (i + 1)) / 12 : null,
  }));
}

/* ── desgloses ──────────────────────────────────────────────────────── */
export interface MixRow { label: string; value: number }
export function computeMix(leads: Lead[]): MixRow[] {
  const open = leads.filter(isOpen);
  const sum = (k: "datosCOP" | "tiCOP" | "consultoriaCOP") => open.reduce((a, l) => a + (l[k] || 0), 0);
  const total = open.reduce((a, l) => a + (l.ingresosEsperados || 0), 0);
  const rows: MixRow[] = [
    { label: "Datos", value: sum("datosCOP") }, { label: "TI", value: sum("tiCOP") }, { label: "Consultoría", value: sum("consultoriaCOP") },
  ];
  const rest = total - rows.reduce((a, r) => a + r.value, 0);
  if (rest > 0) rows.push({ label: "Sin clasificar", value: rest });
  return rows.filter((r) => r.value > 0);
}

export interface PresalesRow { name: string; total: number; states: Record<string, number> }
export function computePresales(leads: Lead[]): PresalesRow[] {
  const map = new Map<string, PresalesRow>();
  leads.filter(isOpen).forEach((l) => {
    if (!l.preventa) return;
    const row = map.get(l.preventa) ?? { name: l.preventa, total: 0, states: {} };
    const st = l.etapaPreventa || "Sin estado";
    row.total += 1; row.states[st] = (row.states[st] ?? 0) + 1;
    map.set(l.preventa, row);
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export interface SellerRow { name: string; won: number; pipeline: number; winRate: number | null }
export function computeRanking(leads: Lead[], r: Range): SellerRow[] {
  const names = new Set(leads.map((l) => l.comercial).filter(Boolean));
  return [...names]
    .map((name) => {
      const mine = leads.filter((l) => l.comercial === name);
      const closed = mine.filter((l) => (isWon(l) || isLost(l)) && inRange(closeDateOf(l), r.start, r.end));
      return {
        name,
        won: mine.filter((l) => isWon(l) && inRange(closeDateOf(l), r.start, r.end)).reduce((a, l) => a + (l.ingresosEsperados || 0), 0),
        pipeline: mine.filter(isOpen).reduce((a, l) => a + (l.ingresosEsperados || 0), 0),
        winRate: closed.length ? Math.round((closed.filter(isWon).length / closed.length) * 100) : null,
      };
    })
    .filter((s) => s.won > 0 || s.pipeline > 0)
    .sort((a, b) => b.won - a.won || b.pipeline - a.pipeline);
}

/* ── atención y próximos cierres ────────────────────────────────────── */
export type AttentionKind = "Vencido" | "Estancado" | "Sin preventa" | "Sin monto";
export interface AttentionItem { lead: Lead; kind: AttentionKind; detail: string }

export function computeAttention(leads: Lead[], now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  leads.filter(isOpen).forEach((l) => {
    const dl = parseDate(l.cierreEsperado), mod = parseDate(l.ultimaModificacion);
    if (dl && dl < now) items.push({ lead: l, kind: "Vencido", detail: `cierre esperado hace ${Math.max(1, Math.floor((now.getTime() - dl.getTime()) / DAY))} d` });
    if (mod && (now.getTime() - mod.getTime()) / DAY > STALLED_DAYS) items.push({ lead: l, kind: "Estancado", detail: `sin cambios ${Math.floor((now.getTime() - mod.getTime()) / DAY)} d` });
    if (!l.preventa && ["Preventa", "Presentación de Oferta", "Evaluación de la Entidad"].includes(l.etapa)) items.push({ lead: l, kind: "Sin preventa", detail: l.etapa });
    if (!l.ingresosEsperados) items.push({ lead: l, kind: "Sin monto", detail: "falta ingreso esperado" });
  });
  const rank: Record<AttentionKind, number> = { "Vencido": 0, "Estancado": 1, "Sin preventa": 2, "Sin monto": 3 };
  return items.sort((a, b) => rank[a.kind] - rank[b.kind] || b.lead.ingresosEsperados - a.lead.ingresosEsperados);
}

export function computeUpcoming(leads: Lead[], now: Date): Lead[] {
  const limit = new Date(now.getTime() + UPCOMING_DAYS * DAY);
  return leads
    .filter((l) => { const d = parseDate(l.cierreEsperado); return isOpen(l) && !!d && d >= now && d <= limit; })
    .sort((a, b) => a.cierreEsperado.localeCompare(b.cierreEsperado));
}
