"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import Panel from "@/components/ui/Panel";
import Pill from "@/components/ui/Pill";
import LeadDetailModal from "@/components/modules/leads/LeadDetailModal";
import { expandAsignaciones, rowKey } from "@/components/modules/leads/presalesAsignaciones";
import { cyclesFor, avg, fmtDays } from "@/components/modules/leads/presalesCycle";
import { personInitials } from "@/components/modules/leads/initials";
import { DEFAULT_PRESALES_SETTINGS, type PresalesSettings } from "@/components/modules/leads/PresalesSettingsPanel";
import type { Lead } from "@/lib/odoo/types";
import type { PresalesTimeline } from "@/lib/odoo/client";

/* Perfil de una persona de Preventa: resumen, leads, estadísticas, seguimiento y trazabilidad.
   Se llega desde el popup del lead (nombre del preventa) y usa los mismos datos y reglas que Presales. */

const DAY = 86400000;
const TABS = ["Resumen", "Leads", "Estadísticas", "Seguimiento", "Trazabilidad"] as const;
type Tab = (typeof TABS)[number];
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const norm = (s: string) => s.trim().toLowerCase();
const isOpen = (l: Lead) => norm(l.etapaPreventa) === "abierto" && l.activo;
const parseDate = (s: string) => { if (!s) return null; const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s.replace(" ", "T")); return isNaN(d.getTime()) ? null : d; };
const lineaCorta = (l: string) => l.replace(/DATOS Y SISTEMAS DE INFORMACI[OÓ]N/gi, "DATOS Y S.I.");
const fmtCOP = (v: number) => (v ? `$ ${v >= 1e9 ? `${(v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 })} mil M` : v >= 1e6 ? `${Math.round(v / 1e6).toLocaleString("es-CO")} M` : v.toLocaleString("es-CO")}` : "—");
const stateTone = (l: Lead) => (l.ganado === "Ganado" ? "good" : l.ganado === "Perdido" ? "bad" : isOpen(l) ? "warn" : "neutral") as "good" | "bad" | "warn" | "neutral";
const stateText = (l: Lead) => (l.ganado === "Ganado" || l.ganado === "Perdido" ? l.ganado : l.etapaPreventa || "Sin estado");
const closeYear = (l: Lead) => (l.fechaEfectivaCierre || l.fechaCierre || "").slice(0, 4);

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 truncate">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
    </div>
  );
}

export default function PersonaView({ name }: { name: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [timeline, setTimeline] = useState<PresalesTimeline | null>(null);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<PresalesSettings>(DEFAULT_PRESALES_SETTINGS);
  const [tab, setTab] = useState<Tab>("Resumen");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [stale, setStale] = useState<number | null>(null);
  const [tipo, setTipo] = useState<string>("Todos");
  const [selected, setSelected] = useState<Lead | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    // ajustes de Presales (máx. de leads abiertos, días sin cambios) guardados en el navegador
    queueMicrotask(() => {
      try { const raw = localStorage.getItem("presales-settings-v1"); if (raw && !cancelled) setSettings({ ...DEFAULT_PRESALES_SETTINGS, ...JSON.parse(raw) }); } catch { /* usa los valores por defecto */ }
    });
    fetch("/api/odoo/leads").then((r) => r.json()).then((d) => { if (cancelled) return; if (d.error) setError(d.error); else setLeads(d.leads as Lead[]); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "No se pudieron cargar los leads."); });
    fetch("/api/presales/timeline").then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled) setTimeline(d as PresalesTimeline | null); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const staleDays = stale ?? settings.staleDays;
  const rows = useMemo(() => (leads ? expandAsignaciones(leads) : []), [leads]);
  const mine = useMemo(() => rows.filter((l) => l.preventa === name), [rows, name]);
  const years = useMemo(() => {
    const ys = new Set<string>([String(new Date().getFullYear())]);
    mine.forEach((l) => { const y = closeYear(l); if (y) ys.add(y); });
    return [...ys].sort().reverse();
  }, [mine]);
  const inYear = (d: string) => year === "ALL" || d.startsWith(year);

  const d = useMemo(() => {
    const open = mine.filter(isOpen);
    const won = mine.filter((l) => l.ganado === "Ganado" && (year === "ALL" || closeYear(l) === year));
    const lost = mine.filter((l) => l.ganado === "Perdido" && (year === "ALL" || closeYear(l) === year));
    const cyc = cyclesFor(timeline, mine, year === "ALL" ? "ALL" : Number(year));
    const teamCyc = cyclesFor(timeline, rows, year === "ALL" ? "ALL" : Number(year));
    const myCyc = avg(cyc.map((c) => c.days));
    const teamAvg = avg(teamCyc.map((c) => c.days));
    // carga abierta por preventa (mismas reglas que Presales)
    const load = new Map<string, number>();
    rows.forEach((l) => { if (l.preventa && isOpen(l)) load.set(l.preventa, (load.get(l.preventa) ?? 0) + 1); });
    const team = [...load.entries()].map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v);
    const wonCOP = won.filter((l) => !norm(l.compania).includes("international")).reduce((s, l) => s + l.ingresosEsperados, 0);
    const closesByMonth = Array(12).fill(0) as number[];
    const myKeys = new Set(mine.map(rowKey));
    (timeline?.closes ?? []).forEach((c) => {
      if (!myKeys.has(`${c.leadId}-${c.slot ?? 1}`) || !inYear(c.date) || year === "ALL") return;
      closesByMonth[Number(c.date.slice(5, 7)) - 1]++;
    });
    const lineas = [...new Set(mine.map((l) => l.linea).filter(Boolean))];
    return { open, won, lost, cyc, myCyc, teamAvg, team, wonCOP, closesByMonth, lineas, rate: won.length + lost.length ? won.length / (won.length + lost.length) : null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, rows, timeline, year]);

  const staleRows = useMemo(() => d.open
    .map((l) => { const m = parseDate(l.ultimaModificacion); return { l, days: m ? Math.floor((now - m.getTime()) / DAY) : 0 }; })
    .filter((r) => r.days >= staleDays).sort((a, b) => b.days - a.days), [d.open, staleDays, now]);

  const events = useMemo(() => {
    const ev: { date: string; title: string; lead: Lead; kind: string }[] = [];
    mine.forEach((l) => { if (l.fechaAsignacion) ev.push({ date: l.fechaAsignacion, title: `Asignado en ${lineaCorta(l.linea) || "preventa"}`, lead: l, kind: "Asignación" }); });
    const byKey = new Map(mine.map((l) => [rowKey(l), l]));
    (timeline?.closes ?? []).forEach((c) => { const l = byKey.get(`${c.leadId}-${c.slot ?? 1}`); if (l) ev.push({ date: c.date, title: "Cierre de preventa", lead: l, kind: "Cierre" }); });
    return ev.sort((a, b) => b.date.localeCompare(a.date));
  }, [mine, timeline]);

  const shown = onlyOpen ? mine.filter(isOpen) : mine;
  const maxMonth = Math.max(1, ...d.closesByMonth);

  let body;
  if (error) body = <p className="text-sm text-rose-400">{error}</p>;
  else if (!leads) body = <div className="flex items-center gap-2 text-slate-400 text-sm py-10"><RefreshCw size={16} className="animate-spin" />Cargando datos de Odoo…</div>;
  else if (mine.length === 0) body = <p className="text-sm text-slate-400 py-10">No encontramos leads con «{name}» como preventa.</p>;
  else if (tab === "Resumen") body = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <Kpi label="Leads abiertos" value={String(d.open.length)} />
        <Kpi label="Ocupación" value={`${Math.round((d.open.length / settings.maxOcupacion) * 100)} %`} sub={`máx. ${settings.maxOcupacion} abiertos`} />
        <Kpi label="Ganados" value={String(d.won.length)} sub={year === "ALL" ? "histórico" : year} />
        <Kpi label="Tasa de cierre" value={d.rate == null ? "—" : `${Math.round(d.rate * 100)} %`} sub={`${d.won.length} de ${d.won.length + d.lost.length} cerrados`} />
        <Kpi label="Ciclo promedio" value={d.cyc.length ? fmtDays(d.myCyc) : "—"} sub={d.teamAvg ? `equipo ${fmtDays(d.teamAvg)}` : undefined} />
        <Kpi label="Ingreso ganado" value={fmtCOP(d.wonCOP)} sub="solo COP" />
      </div>
      <Panel title="Carga frente al equipo" aside={`${d.team.length} preventas con carga`} bodyClass="px-3.5 py-3 space-y-1.5">
        {d.team.slice(0, 10).map((t) => (
          <div key={t.n} className="grid grid-cols-[minmax(0,160px)_1fr_28px] items-center gap-2 text-xs">
            <span className={`truncate ${t.n === name ? "text-slate-100 font-semibold" : "text-slate-400"}`} title={t.n}>{t.n}</span>
            <span className="h-2 rounded-full bg-white/[0.06] overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, (t.v / Math.max(settings.maxOcupacion, d.team[0]?.v ?? 1)) * 100)}%`, background: t.n === name ? "#60a5fa" : "rgba(148,163,184,0.5)" }} /></span>
            <span className="text-right tabular-nums text-slate-300">{t.v}</span>
          </div>
        ))}
        {!d.team.some((t) => t.n === name) && <p className="text-[11px] text-slate-400">{name} no tiene leads abiertos.</p>}
      </Panel>
    </div>
  );
  else if (tab === "Leads") body = (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {[["Todos", false], ["Solo abiertos", true]].map(([t, v]) => (
          <button key={String(t)} type="button" onClick={() => setOnlyOpen(v as boolean)}
            className={`text-xs px-2.5 py-1 rounded-full border ${onlyOpen === v ? "bg-blue-500/15 border-blue-400/40 text-blue-300" : "border-white/[0.1] text-slate-400 hover:text-slate-200"}`}>{t as string}</button>
        ))}
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-xs min-w-[560px]">
          <thead><tr className="text-left text-slate-400 uppercase tracking-wide text-[11px]"><th className="px-3 py-2">Lead</th><th className="px-3 py-2">Línea</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Ingreso</th></tr></thead>
          <tbody>{shown.map((l) => (
            <tr key={rowKey(l)} onClick={() => setSelected(l)} className="row-hover cursor-pointer border-t border-white/[0.06]">
              <td className="px-3 py-2 text-slate-200 max-w-[280px] truncate" title={l.nombre}>{l.nombre}</td>
              <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{lineaCorta(l.linea) || "—"}</td>
              <td className="px-3 py-2"><Pill tone={stateTone(l)}>{stateText(l)}</Pill></td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap">{fmtCOP(l.ingresosEsperados)}</td>
            </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
  else if (tab === "Estadísticas") body = (
    <div className="space-y-3">
      <Panel title="Leads cerrados por mes" aside={year === "ALL" ? "elige un año" : year} bodyClass="px-3.5 py-3">
        {year === "ALL" ? <p className="text-xs text-slate-400">Selecciona un año para ver los cierres por mes.</p> : (
          <div className="flex items-end gap-1.5 h-32">
            {d.closesByMonth.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 text-[11px] text-slate-400 min-w-0">
                <span>{v || ""}</span><span className="w-full rounded-t bg-blue-400/70" style={{ height: `${(v / maxMonth) * 80}px`, minHeight: v ? 3 : 0 }} /><span>{MESES[i]}</span>
              </div>))}
          </div>)}
      </Panel>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Ciclo promedio" value={d.cyc.length ? fmtDays(d.myCyc) : "—"} sub={d.teamAvg ? `equipo ${fmtDays(d.teamAvg)}` : undefined} />
        <Kpi label="Ciclos medidos" value={String(d.cyc.length)} />
        <Kpi label="Líneas atendidas" value={String(d.lineas.length)} sub={d.lineas.map(lineaCorta).join(" · ") || undefined} />
        <Kpi label="Perdidos" value={String(d.lost.length)} sub={year === "ALL" ? "histórico" : year} />
      </div>
    </div>
  );
  else if (tab === "Seguimiento") body = (
    <div className="space-y-2">
      <label className="flex items-center gap-3 text-xs text-slate-400">Sin cambios desde hace más de
        <input type="range" min={1} max={60} step={1} value={staleDays} onChange={(e) => setStale(Number(e.target.value))} className="flex-1 max-w-[220px]" />
        <b className="text-slate-200 tabular-nums">{staleDays} d</b>
      </label>
      <Panel title={`Leads para atender (${staleRows.length})`} bodyClass="px-1.5 py-1.5">
        {staleRows.length === 0 ? <p className="px-2 py-3 text-xs text-slate-400">Todo al día.</p> : staleRows.map(({ l, days }) => (
          <button key={rowKey(l)} type="button" onClick={() => setSelected(l)} className="row-hover w-full flex items-center justify-between gap-3 px-2 py-2 text-xs text-left rounded">
            <span className="text-slate-200 truncate">{l.nombre}</span><Pill tone={days >= staleDays * 2 ? "bad" : "warn"}>{days} d sin cambios</Pill>
          </button>))}
      </Panel>
    </div>
  );
  else body = (
    <div className="space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {["Todos", "Asignación", "Cierre"].map((t) => (
          <button key={t} type="button" onClick={() => setTipo(t)}
            className={`text-xs px-2.5 py-1 rounded-full border ${tipo === t ? "bg-blue-500/15 border-blue-400/40 text-blue-300" : "border-white/[0.1] text-slate-400 hover:text-slate-200"}`}>{t}</button>))}
      </div>
      <Panel title="Historial" aside={`${events.filter((e) => tipo === "Todos" || e.kind === tipo).length} eventos`} bodyClass="px-3.5 py-3">
        <ul className="space-y-3">
          {events.filter((e) => tipo === "Todos" || e.kind === tipo).slice(0, 80).map((e, i) => (
            <li key={i} className="flex gap-3 text-xs">
              <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-slate-200"><span className="font-medium">{e.title}</span> · <button type="button" onClick={() => setSelected(e.lead)} className="text-blue-400 hover:underline truncate">{e.lead.nombre}</button></p>
                <p className="text-[11px] text-slate-400">{e.date.slice(0, 16)} · {e.kind}</p>
              </div>
            </li>))}
          {events.length === 0 && <p className="text-xs text-slate-400">Sin eventos registrados.</p>}
        </ul>
      </Panel>
    </div>
  );

  return (
    <>
      <Topbar title="Persona" />
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-3">
        <button type="button" onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"><ArrowLeft size={14} />Volver</button>
        <header className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <span className="w-11 h-11 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-sm font-semibold" aria-hidden>{personInitials(name)}</span>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-slate-100 uppercase tracking-wide truncate">{name}</h1>
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              <Pill tone="info">Preventa</Pill>
              {d.lineas.map((l) => <Pill key={l}>{lineaCorta(l)}</Pill>)}
            </div>
          </div>
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Periodo" className="h-8 rounded-lg border border-white/[0.1] bg-transparent px-2 text-xs text-slate-300">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}<option value="ALL">Todo el histórico</option>
          </select>
        </header>
        <nav className="flex gap-0.5 border-b border-white/[0.08] overflow-x-auto no-scrollbar" aria-label="Secciones del perfil">
          {TABS.map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 ${tab === t ? "text-slate-100 border-blue-400" : "text-slate-400 border-transparent hover:text-slate-200"}`}>{t}</button>))}
        </nav>
        {body}
      </div>
      {selected && <LeadDetailModal lead={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
