import Link from "next/link";
import type { Company, Kpis } from "@/lib/dashboard/metrics";
import { ANNUAL_GOAL_COP } from "@/lib/dashboard/config";
import { Card, Delta, fmtMoney } from "./ui";

interface Props { kpis: Kpis; company: Company; attentionCount: number; periodLabel: string; loading: boolean }

function Kpi({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
      <div className="text-2xl md:text-[28px] font-bold text-white mt-2 tabular-nums">{value}</div>
      <div className="text-xs mt-1 text-slate-400">{children}</div>
    </Card>
  );
}

export default function KpiRow({ kpis, company, attentionCount, periodLabel, loading }: Props) {
  const v = (s: string) => (loading ? "—" : s);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3.5">
      <Kpi label="Pipeline abierto" value={v(fmtMoney(kpis.pipeline, company))}>{kpis.openCount} oportunidades abiertas</Kpi>
      <Kpi label="Forecast ponderado" value={v(fmtMoney(kpis.forecast, company))}>
        {ANNUAL_GOAL_COP && company === "COP"
          ? `${Math.round((kpis.forecast / ANNUAL_GOAL_COP) * 100)}% de la meta anual`
          : "monto × probabilidad por etapa"}
      </Kpi>
      <Kpi label={`Ganado · ${periodLabel}`} value={v(fmtMoney(kpis.won, company))}>
        <Delta now={kpis.won} prev={kpis.prevWon} /> <span>· {kpis.wonCount} cierres</span>
      </Kpi>
      <Kpi label="Tasa de cierre" value={v(kpis.winRate === null ? "—" : `${kpis.winRate}%`)}>
        <Delta now={kpis.winRate} prev={kpis.prevWinRate} suffix=" pp" />
        {kpis.cycleDays !== null && <span> · ciclo {kpis.cycleDays} d</span>}
      </Kpi>
      <Card tone={attentionCount ? "warn" : undefined}>
        <div className="text-[11px] uppercase tracking-wider text-amber-400 font-semibold">Requieren atención</div>
        <div className="text-2xl md:text-[28px] font-bold text-white mt-2 tabular-nums">{v(String(attentionCount))}</div>
        <Link href="/leads" className="text-xs text-slate-400 hover:text-white mt-1 inline-block">Ver en Leads →</Link>
      </Card>
    </div>
  );
}
