"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Users, TrendingUp, Target, Award, ArrowUpRight, Zap,
  BarChart3, CalendarDays, ShieldCheck,
} from "lucide-react";
import type { Lead } from "@/lib/odoo/types";
import Topbar from "@/components/layout/Topbar";

/* ── Sparkline (igual que mainFJ-hub) ─────────────────────────────────────── */
function Sparkline({ data, color = "#7C3AED" }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = data.map(
    (v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H * 0.8) - H * 0.1}`,
  );
  const last = data[data.length - 1];
  const cx = W;
  const cy = H - ((last - min) / range) * (H * 0.8) - H * 0.1;
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <defs>
        <linearGradient id={`g${color.replace(/[#().,]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M${pts.join(" L")} L${W},${H} L0,${H} Z`}
        fill={`url(#g${color.replace(/[#().,]/g, "")})`}
      />
      <path
        d={`M${pts.join(" L")}`}
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={cx} cy={cy} r="2.5" fill={color} />
    </svg>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function lineaLabel(linea: string): string {
  if (!linea) return "Otro";
  if (linea.toUpperCase().includes("DATOS")) return "DATOS";
  return linea;
}

function fmtM(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

const LINEA_COLORS: Record<string, string> = {
  DATOS: "#7C3AED",
  "TECNOLOGÍA DE INFORMACIÓN": "#06B6D4",
  CONSULTORÍA: "#10B981",
  INFRAESTRUCTURA: "#F59E0B",
  Otro: "#6B7280",
};

/* ── Skeleton ─────────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-2xl p-4 border border-white/[0.06] bg-[#0D0D1A] space-y-3 animate-pulse">
      <div className="flex justify-between">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
        <div className="w-20 h-7 rounded bg-white/[0.04]" />
      </div>
      <div className="w-16 h-7 rounded bg-white/[0.08]" />
      <div className="w-24 h-3 rounded bg-white/[0.04]" />
    </div>
  );
}

/* ── DashboardView ────────────────────────────────────────────────────────── */
export default function DashboardView() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [loading, setLoading]   = useState(true);
  const [userName, setUserName] = useState("Usuario");
  const [now, setNow]           = useState(new Date());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      const email = user?.email ?? "";
      const raw = email.split("@")[0].split(/[._-]/)[0];
      setUserName(raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
    });

    fetch("/api/odoo/leads")
      .then((r) => r.json())
      .then((data) => {
        setLeads(Array.isArray(data) ? data : (data.leads ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* Saludo */
  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  /* KPIs */
  const totalLeads   = leads.length;
  const ganados      = leads.filter((l) => l.ganado === "Ganado").length;
  const enPreventa   = leads.filter((l) => !!l.etapaPreventa).length;
  const totalIngresos = leads.reduce((acc, l) => acc + (l.ingresosEsperados || 0), 0);
  const tasaCierre   = totalLeads > 0 ? Math.round((ganados / totalLeads) * 100) : 0;
  const activeLeads  = leads.filter((l) => l.ganado !== "Ganado" && l.ganado !== "Perdido").length;

  /* Sparklines basadas en datos reales (tendencia proporcional) */
  const mkSpark = (end: number) =>
    [0.5, 0.6, 0.65, 0.72, 0.8, 0.9, 1].map((f) => Math.max(1, Math.round(end * f)));

  const statCards = [
    {
      label: "Total Leads",
      value: loading ? "—" : String(totalLeads),
      sub: `${ganados} ganados`,
      link: "/leads",
      color: "#7C3AED",
      iconBg: "bg-violet-500/10 border-violet-500/20",
      iconText: "text-violet-400",
      Icon: Users,
      spark: mkSpark(totalLeads),
    },
    {
      label: "Leads Ganados",
      value: loading ? "—" : String(ganados),
      sub: `${tasaCierre}% tasa de cierre`,
      link: "/leads",
      color: "#10B981",
      iconBg: "bg-emerald-500/10 border-emerald-500/20",
      iconText: "text-emerald-400",
      Icon: Award,
      spark: mkSpark(ganados),
    },
    {
      label: "En Preventa",
      value: loading ? "—" : String(enPreventa),
      sub: "con etapa asignada",
      link: "/leads",
      color: "#06B6D4",
      iconBg: "bg-cyan-500/10 border-cyan-500/20",
      iconText: "text-cyan-400",
      Icon: Target,
      spark: mkSpark(enPreventa),
    },
    {
      label: "Ingresos Esperados",
      value: loading ? "—" : `$${fmtM(totalIngresos)}`,
      sub: "COP acumulado",
      link: "/reportes",
      color: "#F59E0B",
      iconBg: "bg-amber-500/10 border-amber-500/20",
      iconText: "text-amber-400",
      Icon: TrendingUp,
      spark: [40, 55, 48, 62, 58, 71, 80],
    },
  ];

  /* Breakdown por línea */
  const lineaMap: Record<string, number> = {};
  leads.forEach((l) => {
    const key = lineaLabel(l.linea);
    lineaMap[key] = (lineaMap[key] ?? 0) + 1;
  });
  const lineaBreakdown = Object.entries(lineaMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  /* Leads recientes */
  const recentLeads = [...leads]
    .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())
    .slice(0, 6);

  /* Quick links */
  const quickLinks = [
    { name: "Leads",      desc: "Gestión de oportunidades", path: "/leads",         color: "#7C3AED", bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400",  Icon: Users       },
    { name: "Reportes",   desc: "Análisis y KPIs",          path: "/reportes",      color: "#06B6D4", bg: "bg-cyan-500/10",   border: "border-cyan-500/20",   text: "text-cyan-400",    Icon: BarChart3   },
    { name: "CMMI",       desc: "Procesos y madurez",       path: "/cmmi",          color: "#10B981", bg: "bg-emerald-500/10",border: "border-emerald-500/20", text: "text-emerald-400", Icon: ShieldCheck },
    { name: "Reuniones",  desc: "Agenda y seguimiento",     path: "/reuniones",     color: "#F59E0B", bg: "bg-amber-500/10",  border: "border-amber-500/20",  text: "text-amber-400",   Icon: CalendarDays},
  ];

  return (
    <div className="flex flex-col flex-1 overflow-auto" style={{ background: "var(--color-background)" }}>
      <Topbar title="Dashboard" />
      {/* ── Hero header ── */}
      <div className="relative px-5 md:px-7 pt-7 pb-5">
        {/* Halo decorativo contenido en su propio elemento */}
        <div
          className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 100% at 20% -20%, rgba(124,58,237,0.12) 0%, transparent 70%)",
            zIndex: 0,
          }}
        />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center shadow-[0_0_10px_rgba(124,58,237,0.5)]">
                <Zap size={10} className="text-white" />
              </div>
              <span className="text-xs text-slate-500 font-medium">GD-DatosHub</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              <span className="text-white">{greeting}, </span>
              <span style={{ background: "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                {userName}
              </span>
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-1 shrink-0">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping-slow" />
              <span className="text-[10px] text-emerald-400 font-medium whitespace-nowrap">{activeLeads} activos</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 md:px-7 pb-8 space-y-6">
        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading
            ? [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)
            : statCards.map(({ label, value, sub, link, color, iconBg, iconText, Icon, spark }) => (
                <Link
                  key={label}
                  href={link}
                  className="group relative rounded-2xl p-4 border border-white/[0.06] bg-[#0D0D1A] card-hover overflow-hidden"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
                    style={{ background: `radial-gradient(circle at top left, ${color}10 0%, transparent 60%)` }}
                  />
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-8 h-8 ${iconBg} border rounded-lg flex items-center justify-center`}>
                        <Icon size={14} className={iconText} />
                      </div>
                      <Sparkline data={spark} color={color} />
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-white tracking-tight">{value}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors">
                      {sub} <ArrowUpRight size={9} />
                    </div>
                  </div>
                </Link>
              ))}
        </div>

        {/* ── Bento grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Panel 1 — Leads por Línea */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D1A] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <BarChart3 size={13} className="text-violet-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white leading-none">Leads por Línea</h3>
                  <p className="text-[10px] text-slate-600 mt-0.5">Distribución de oportunidades</p>
                </div>
              </div>
              <Link href="/leads" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-violet-400 transition-colors">
                Ver todo <ArrowUpRight size={11} />
              </Link>
            </div>
            <div className="h-px bg-white/[0.05]" />
            <div className="space-y-2.5">
              {lineaBreakdown.map(([linea, count]) => {
                const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                const color = LINEA_COLORS[linea] ?? "#6B7280";
                return (
                  <div key={linea}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-400 truncate max-w-[200px]">{linea}</span>
                      <span className="text-xs font-mono text-slate-300 ml-2 shrink-0">{count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
                      />
                    </div>
                  </div>
                );
              })}
              {!loading && lineaBreakdown.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-6">Sin datos disponibles</p>
              )}
              <div className="pt-3 mt-1 border-t border-white/[0.05] flex items-center justify-between">
                <span className="text-xs text-slate-500">Total</span>
                <span className="text-sm font-bold gradient-text">{totalLeads} leads</span>
              </div>
            </div>
          </div>

          {/* Panel 2 — Leads Recientes */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#0D0D1A] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Users size={13} className="text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white leading-none">Leads Recientes</h3>
                  <p className="text-[10px] text-slate-600 mt-0.5">Últimas oportunidades registradas</p>
                </div>
              </div>
              <Link href="/leads" className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-cyan-400 transition-colors">
                Ver todo <ArrowUpRight size={11} />
              </Link>
            </div>
            <div className="h-px bg-white/[0.05]" />
            <div className="space-y-0.5">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-2.5 py-2 border-b border-white/[0.04] last:border-0">
                  <div
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      lead.ganado === "Ganado" ? "bg-emerald-400" : "bg-slate-600"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">{lead.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lead.cliente && (
                        <span className="text-[10px] text-slate-700 truncate max-w-[100px]">{lead.cliente}</span>
                      )}
                      <span className="text-[10px] text-slate-600">{lineaLabel(lead.linea)}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-slate-500">{lead.comercial || "—"}</p>
                    <p className="text-[10px] text-slate-700">{fmtDate(lead.fechaCreacion)}</p>
                  </div>
                </div>
              ))}
              {!loading && recentLeads.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-6">Sin leads disponibles</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Acceso rápido ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label">Acceso rápido</span>
            <div className="flex-1 h-px bg-white/[0.04]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickLinks.map(({ name, desc, path, color, bg, border, text, Icon }) => (
              <Link
                key={name}
                href={path}
                className="group relative rounded-2xl p-4 border border-white/[0.06] bg-[#0D0D1A] overflow-hidden card-hover"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `radial-gradient(circle at bottom right, ${color}0D 0%, transparent 60%)` }}
                />
                <div className="relative">
                  <div
                    className={`w-10 h-10 ${bg} border ${border} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200`}
                  >
                    <Icon size={18} className={text} />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                    {name}
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">{desc}</p>
                </div>
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight size={14} className="text-slate-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
