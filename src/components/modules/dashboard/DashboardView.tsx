"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Lead } from "@/lib/odoo/types";
import {
  DEFAULT_FILTERS, applyFilters, computeAttention, computeFunnel, computeKpis, computeMix,
  computePresales, computeSparks, computeRanking, computeRevenue, computeWonLeads, computeUpcoming, periodRange,
  type Company, type Filters, type Period,
} from "@/lib/dashboard/metrics";
import { ETAPA_ORDER } from "@/components/modules/leads/etapaOrder";
import Topbar from "@/components/layout/Topbar";
import LeadDetailModal from "@/components/modules/leads/LeadDetailModal";
import { useDashboardData } from "./useDashboardData";
import FilterBar from "./FilterBar";
import KpiRow from "./KpiRow";
import Funnel from "./Funnel";
import RevenueChart from "./RevenueChart";
import { MixByLine, PresalesLoad, SalesRanking } from "./Breakdowns";
import { AttentionList, UpcomingCloses } from "./Lists";
import ModulesStrip from "./ModulesStrip";
import WonLeadsModal from "./WonLeadsModal";

const PERIODS: Period[] = ["month", "quarter", "year"];
const COMPANIES: Company[] = ["COP", "USD"];

/** Los filtros viajan en la URL (?periodo=&co=&linea=&comercial=&etapa=) para poder compartir la vista. */
function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const periodo = p.get("periodo") as Period | null;
  const co = p.get("co") as Company | null;
  return {
    period: periodo && PERIODS.includes(periodo) ? periodo : DEFAULT_FILTERS.period,
    company: co && COMPANIES.includes(co) ? co : DEFAULT_FILTERS.company,
    linea: p.get("linea") ?? "ALL",
    comercial: p.get("comercial") ?? "ALL",
    etapa: p.get("etapa") ?? "ALL",
  };
}

function writeFilters(f: Filters) {
  const p = new URLSearchParams();
  if (f.period !== DEFAULT_FILTERS.period) p.set("periodo", f.period);
  if (f.company !== DEFAULT_FILTERS.company) p.set("co", f.company);
  if (f.linea !== "ALL") p.set("linea", f.linea);
  if (f.comercial !== "ALL") p.set("comercial", f.comercial);
  if (f.etapa !== "ALL") p.set("etapa", f.etapa);
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export default function DashboardView() {
  const { leads, loading, error, updatedAt, reload } = useDashboardData();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [userName, setUserName] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [wonOpen, setWonOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // sincroniza con la URL una sola vez al montar (window no existe en SSR)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setFilters(readFilters()); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      const raw = (user?.email ?? "").split("@")[0].split(/[._-]/)[0];
      setUserName(raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "");
    });
  }, []);

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    writeFilters(next);
  };
  const reset = () => update({ linea: "ALL", comercial: "ALL", etapa: "ALL" });

  const range = useMemo(() => periodRange(filters.period, now), [filters.period, now]);
  // opciones de filtro: sobre la compañía elegida, para que no aparezcan valores de la otra
  const byCompany = useMemo(() => applyFilters(leads, { ...DEFAULT_FILTERS, company: filters.company }), [leads, filters.company]);
  const lineas = useMemo(() => [...new Set(byCompany.map((l) => l.linea).filter(Boolean))].sort(), [byCompany]);
  const comerciales = useMemo(() => [...new Set(byCompany.map((l) => l.comercial).filter(Boolean))].sort(), [byCompany]);

  const scoped = useMemo(() => applyFilters(leads, filters), [leads, filters]);
  const kpis = useMemo(() => computeKpis(scoped, range), [scoped, range]);
  const wonLeads = useMemo(() => computeWonLeads(scoped, range), [scoped, range]);
  const sparks = useMemo(() => computeSparks(scoped, now), [scoped, now]);
  const funnel = useMemo(() => computeFunnel(applyFilters(leads, { ...filters, etapa: "ALL" }), ETAPA_ORDER), [leads, filters]);
  const revenue = useMemo(() => computeRevenue(scoped, now, kpis.forecast), [scoped, now, kpis.forecast]);
  const mix = useMemo(() => computeMix(scoped), [scoped]);
  const presales = useMemo(() => computePresales(scoped), [scoped]);
  const ranking = useMemo(() => computeRanking(applyFilters(leads, { ...filters, comercial: "ALL" }), range), [leads, filters, range]);
  const attention = useMemo(() => computeAttention(scoped, now), [scoped, now]);
  const upcoming = useMemo(() => computeUpcoming(scoped, now), [scoped, now]);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="flex flex-col flex-1 overflow-auto">
      <Topbar title="Dashboard" />
      <div className="px-5 md:px-7 pt-4 pb-8 space-y-4 max-w-[1400px] w-full mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            {greeting}{userName ? `, ${userName}` : ""}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Resumen comercial · {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        <FilterBar filters={filters} onChange={update} onReset={reset} lineas={lineas} comerciales={comerciales}
          periodLabel={range.label} updatedAt={updatedAt} loading={loading} onReload={reload} />

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 flex items-center gap-3 text-sm text-rose-200">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="flex-1">No se pudieron cargar los leads: {error}</span>
            <button type="button" onClick={reload} className="px-3 py-1 rounded-lg border border-rose-400/40 hover:bg-rose-500/20 text-xs">Reintentar</button>
          </div>
        )}

        <KpiRow kpis={kpis} sparks={sparks} onOpenWon={() => setWonOpen(true)} company={filters.company} attentionCount={attention.length} periodLabel={range.label} loading={loading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <Funnel rows={funnel} company={filters.company} selected={filters.etapa} onSelect={(etapa) => update({ etapa })} />
          <RevenueChart data={revenue} company={filters.company} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          <MixByLine rows={mix} company={filters.company} />
          <PresalesLoad rows={presales} />
          <SalesRanking rows={ranking} company={filters.company} periodLabel={range.label}
            onSelect={(name) => update({ comercial: filters.comercial === name ? "ALL" : name })} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <AttentionList items={attention} company={filters.company} onOpen={setSelectedLead} />
          <UpcomingCloses leads={upcoming} company={filters.company} onOpen={setSelectedLead} />
        </div>

        <ModulesStrip />
      </div>

      {wonOpen && (
        <WonLeadsModal leads={wonLeads} company={filters.company} periodLabel={range.label}
          onOpenLead={setSelectedLead} onClose={() => setWonOpen(false)} escDisabled={!!selectedLead} />
      )}
      {selectedLead && <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />}
    </div>
  );
}
