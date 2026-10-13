import Link from "next/link";
import { AlertTriangle, ShieldCheck, Target, TrendingUp, Users, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import type { Company, Kpis, Sparks } from "@/lib/dashboard/metrics";
import { ANNUAL_GOAL_COP } from "@/lib/dashboard/config";
import { Delta, fmtMoney } from "./ui";

/* Sparkline de área con punto final (mismo estilo del dashboard anterior) */
function Sparkline({ data, color, id }: { data: number[]; color: string; id: string }) {
  if (data.length < 2 || data.every((v) => v === 0)) return <div className="w-20 h-7" aria-hidden="true" />;
  const W = 80, H = 28;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const y = (v: number) => H - ((v - min) / range) * (H * 0.8) - H * 0.1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${y(v)}`);
  return (
    <svg width={W} height={H} className="shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${pts.join(" L")} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />
      <path d={`M${pts.join(" L")}`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W} cy={y(data[data.length - 1])} r="2.5" fill={color} />
    </svg>
  );
}

interface CardProps {
  id: string; label: string; value: string; sub: ReactNode; href?: string; onClick?: () => void;
  color: string; iconBg: string; iconText: string; Icon: typeof Users; spark?: number[];
}

function KpiCard({ id, label, value, sub, href, onClick, color, iconBg, iconText, Icon, spark }: CardProps) {
  const cls = "group relative rounded-2xl p-4 border border-white/[0.06] bg-[#0D0D1A] card-hover overflow-hidden text-left w-full";
  const content = (
    <>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{ background: `radial-gradient(circle at top left, ${color}10 0%, transparent 60%)` }} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-8 h-8 ${iconBg} border rounded-lg flex items-center justify-center`}><Icon size={14} className={iconText} /></div>
          {spark && <Sparkline data={spark} color={color} id={`spark-${id}`} />}
        </div>
        <div className="text-xl md:text-2xl font-bold text-white tracking-tight tabular-nums">{value}</div>
        <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
        <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">
          {sub} <ArrowUpRight size={9} />
        </div>
      </div>
    </>
  );
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} cursor-pointer`}>{content}</button>
    : <Link href={href ?? "/leads"} className={cls}>{content}</Link>;
}

interface Props { kpis: Kpis; sparks: Sparks; onOpenWon: () => void; company: Company; attentionCount: number; periodLabel: string; loading: boolean }

export default function KpiRow({ kpis, sparks, onOpenWon, company, attentionCount, periodLabel, loading }: Props) {
  const v = (s: string) => (loading ? "—" : s);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      <KpiCard id="pipeline" label="Pipeline abierto" value={v(fmtMoney(kpis.pipeline, company))} href="/leads"
        sub={`${kpis.openCount} oportunidades abiertas`} spark={sparks.pipeline}
        color="#7C3AED" iconBg="bg-violet-500/10 border-violet-500/20" iconText="text-violet-400" Icon={Users} />
      <KpiCard id="forecast" label="Forecast ponderado" value={v(fmtMoney(kpis.forecast, company))} href="/reportes"
        sub={ANNUAL_GOAL_COP && company === "COP" ? `${Math.round((kpis.forecast / ANNUAL_GOAL_COP) * 100)}% de la meta anual` : "monto × probabilidad por etapa"}
        spark={sparks.forecast}
        color="#06B6D4" iconBg="bg-cyan-500/10 border-cyan-500/20" iconText="text-cyan-400" Icon={Target} />
      <KpiCard id="won" label={`Ganado · ${periodLabel}`} value={v(fmtMoney(kpis.won, company))} onClick={onOpenWon}
        sub={<><Delta now={kpis.won} prev={kpis.prevWon} /><span>· {kpis.wonCount} cierres</span></>} spark={sparks.won}
        color="#10B981" iconBg="bg-emerald-500/10 border-emerald-500/20" iconText="text-emerald-400" Icon={TrendingUp} />
      <KpiCard id="winrate" label="Tasa de cierre" value={v(kpis.winRate === null ? "—" : `${kpis.winRate}%`)} href="/reportes"
        sub={<><Delta now={kpis.winRate} prev={kpis.prevWinRate} suffix=" pp" />{kpis.cycleDays !== null && <span>· ciclo {kpis.cycleDays} d</span>}</>}
        spark={sparks.winRate}
        color="#F59E0B" iconBg="bg-amber-500/10 border-amber-500/20" iconText="text-amber-400" Icon={ShieldCheck} />
      <KpiCard id="attention" label="Requieren atención" value={v(String(attentionCount))} href="/leads"
        sub="vencidos, estancados y sin datos"
        color="#FB7185" iconBg="bg-rose-500/10 border-rose-500/20" iconText="text-rose-400" Icon={AlertTriangle} />
    </div>
  );
}
